import { expect, it, vi } from "vitest";
import { createArticleHandler } from "./index";
import { dailyArticleFixture } from "../../../e2e/fixtures/daily-article";
import { PET_STUDY_WORDS } from "../../../src/pet/pet-words";

const environment: Record<string, string> = { SUPABASE_URL: "https://auth.example.test", SUPABASE_ANON_KEY: "public-test", PET_AI_BASE_URL: "https://ai.example.test/v1", PET_AI_API_KEY: "server-secret-test", PET_AI_MODEL: "test-model" };
const getEnv = (name: string): string | undefined => environment[name];
const request = (wordIds = PET_STUDY_WORDS.slice(0, 6).map((word) => word.id)): Request => new Request("https://function.example.test", { method: "POST", headers: { Authorization: "Bearer session-test", "Content-Type": "application/json" }, body: JSON.stringify({ date: "2026-09-09", wordIds }) });

it("handles preflight and rejects missing authorization without contacting AI", async () => {
  const mockFetch = vi.fn();
  const handler = createArticleHandler(getEnv, mockFetch);
  expect((await handler(new Request("https://function.example.test", { method: "OPTIONS" }))).status).toBe(204);
  expect((await handler(new Request("https://function.example.test", { method: "POST" }))).status).toBe(401);
  expect(mockFetch).not.toHaveBeenCalled();
});

it("validates the user, keeps the provider key server-side and deduplicates repeated requests", async () => {
  const mockFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("/auth/v1/user")
    ? new Response(JSON.stringify({ id: "user-1", email: "run1@pet-vocab.invalid" }))
    : new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(dailyArticleFixture) } }] })));
  const handler = createArticleHandler(getEnv, mockFetch);
  const first = await handler(request());
  expect(first.status).toBe(200);
  const data = await first.text();
  expect(data).toContain(dailyArticleFixture.title);
  expect(data).not.toContain("server-secret-test");
  expect((await handler(request())).status).toBe(200);
  expect(mockFetch.mock.calls.filter(([url]) => String(url).includes("/chat/completions"))).toHaveLength(1);
});

it("rejects forged sessions and invalid words, and reports missing service configuration", async () => {
  expect((await createArticleHandler(() => undefined)(request())).status).toBe(503);
  const denied = createArticleHandler(getEnv, vi.fn(async () => new Response("denied", { status: 401 })));
  expect((await denied(request())).status).toBe(401);
  const authenticated = vi.fn(async () => new Response(JSON.stringify({ id: "user-1", email: "run1@pet-vocab.invalid" })));
  expect((await createArticleHandler(getEnv, authenticated)(request([999]))).status).toBe(400);
  expect(authenticated).toHaveBeenCalledTimes(1);
});

it("does not return provider errors or accept incomplete generated articles", async () => {
  const mockFetch = vi.fn(async (url: string | URL | Request) => String(url).includes("/auth/v1/user")
    ? new Response(JSON.stringify({ id: "user-1", email: "run1@pet-vocab.invalid" }))
    : new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })));
  expect((await createArticleHandler(getEnv, mockFetch)(request())).status).toBe(502);
});
