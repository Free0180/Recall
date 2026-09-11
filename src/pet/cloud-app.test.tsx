import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CloudSnapshot } from "./cloud-sync";

const state = vi.hoisted(() => ({ remote: null as CloudSnapshot | null, writes: 0 }));
vi.mock("./pet-auth", async importOriginal => ({
  ...await importOriginal<typeof import("./pet-auth")>(),
  loadPetSession: async () => ({ username: "RUN1", role: "learner" }),
  subscribePetSession: () => () => undefined,
}));
vi.mock("./cloud-transport", () => ({ createCloudTransport: () => ({
  read: async () => state.remote,
  write: async (payload: string, revision: number) => {
    state.writes++;
    if ((state.remote?.revision ?? 0) !== revision) return null;
    state.remote = { payload, revision: revision + 1 };
    return state.remote;
  },
}) }));
import { PetApp } from "./pet-app";

const progress = (rating: string) => JSON.stringify({
  speech: { voiceURI: "", mode: "auto" }, vocabulary: { 1: "unknown" }, appliedVocabulary: { 1: "unknown" }, savedWords: [],
  activeIndex: 0, ratings: { 1: rating }, reviews: [], streak: 1, lastStudyDate: null, schedule: null,
});
beforeEach(() => { localStorage.clear(); state.writes = 0; });
afterEach(cleanup);
it("adopts cloud progress on a new device despite the generated empty schedule", async () => {
  state.remote = { payload: progress("again"), revision: 3 };
  render(<PetApp />);
  await waitFor(() => expect(JSON.parse(localStorage.getItem("pet-vocab-progress-v2-RUN1") ?? "{}").ratings?.[1]).toBe("again"), { timeout: 4000 });
  expect(state.remote.revision).toBe(3);
  fireEvent.click(screen.getByRole("button", { name: "我的" }));
  expect(screen.getByLabelText("云同步").textContent).not.toContain("都有不同记录");
});
it("shows conflict controls and preserves existing local learning", async () => {
  state.remote = { payload: progress("known"), revision: 3 };
  localStorage.setItem("pet-vocab-progress-v2-RUN1", progress("again"));
  render(<PetApp />);
  await screen.findByRole("button", { name: "我的" });
  fireEvent.click(screen.getByRole("button", { name: "我的" }));
  await screen.findByRole("button", { name: "使用云端版本" }, { timeout: 4000 });
  expect(state.writes).toBe(0);
  expect(JSON.parse(localStorage.getItem("pet-vocab-progress-v2-RUN1")!).ratings[1]).toBe("again");
  fireEvent.click(screen.getByRole("button", { name: "使用云端版本" }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem("pet-vocab-progress-v2-RUN1")!).ratings[1]).toBe("known"));
  expect(Object.keys(localStorage).some(key => key.startsWith("pet-cloud-v1-RUN1-conflict-"))).toBe(true);
});
