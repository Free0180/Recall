import { afterEach, expect, it, vi } from "vitest";
import { CloudSync, type CloudSnapshot, type CloudTransport } from "./cloud-sync";

afterEach(() => vi.useRealTimers());
function setup(initial = "local", remote: CloudSnapshot | null = null, persisted?: string) {
  const values = new Map<string, string>(persisted ? [["sync", persisted]] : []);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const transport: CloudTransport = {
    read: vi.fn(async () => remote),
    write: vi.fn(async (payload, revision) => {
      if (revision !== (remote?.revision ?? 0)) return null;
      remote = { payload, revision: revision + 1 };
      return remote;
    }),
  };
  const apply = vi.fn();
  const status = vi.fn();
  const sync = new CloudSync("sync", initial, value => value === "empty", storage, transport, apply, status);
  return { sync, values, transport, apply, status, remote: () => remote };
}
it("uploads first local data and acknowledges the revision", async () => {
  const test = setup();
  await test.sync.sync();
  expect(test.remote()).toEqual({ payload: "local", revision: 1 });
  expect(test.status).toHaveBeenLastCalledWith("synced");
  test.sync.dispose();
});
it("pulls a new device's cloud data without uploading its empty default", async () => {
  const test = setup("empty", { payload: "cloud", revision: 4 });
  await test.sync.sync();
  expect(test.apply).toHaveBeenCalledWith("cloud");
  expect(test.transport.write).not.toHaveBeenCalled();
  test.sync.dispose();
});
it("preserves both sides of a conflict and only writes after a choice", async () => {
  const test = setup("local", { payload: "cloud", revision: 4 });
  await test.sync.sync();
  expect(test.status).toHaveBeenLastCalledWith("conflict");
  expect(test.transport.write).not.toHaveBeenCalled();
  await test.sync.resolve("local");
  expect(test.remote()).toEqual({ payload: "local", revision: 5 });
  expect([...test.values.keys()].some(key => key.startsWith("sync-conflict-"))).toBe(true);
  test.sync.dispose();
});
it("recovers the durable outbox after a refresh while offline", async () => {
  const test = setup("stale", { payload: "base", revision: 2 }, JSON.stringify({ local: "pending", base: { payload: "base", revision: 2 } }));
  expect(test.apply).toHaveBeenCalledWith("pending");
  await test.sync.sync();
  expect(test.remote()?.payload).toBe("pending");
  test.sync.dispose();
});
it("does not acknowledge edits made while an upload is in flight", async () => {
  vi.useFakeTimers();
  const test = setup();
  let finish!: (snapshot: CloudSnapshot) => void;
  test.transport.write = vi.fn(() => new Promise<CloudSnapshot>(resolve => { finish = resolve; }));
  const request = test.sync.sync();
  await Promise.resolve();
  test.sync.stage("newer");
  finish({ payload: "local", revision: 1 });
  await request;
  expect(test.status).toHaveBeenLastCalledWith("pending");
  expect(JSON.parse(test.values.get("sync")!).local).toBe("newer");
  test.sync.dispose();
});
it("ignores an old account's late response after dispose", async () => {
  const test = setup("empty");
  let finish!: (snapshot: CloudSnapshot) => void;
  test.transport.read = vi.fn(() => new Promise<CloudSnapshot>(resolve => { finish = resolve; }));
  const request = test.sync.sync();
  test.sync.dispose();
  finish({ payload: "other account", revision: 2 });
  await request;
  expect(test.apply).not.toHaveBeenCalled();
});
it("keeps edits on a failed network request", async () => {
  vi.useFakeTimers();
  const test = setup();
  test.sync.stage("offline edit");
  test.transport.read = vi.fn(async () => { throw new Error("offline"); });
  await test.sync.sync();
  expect(test.status).toHaveBeenLastCalledWith("error");
  expect(JSON.parse(test.values.get("sync")!).local).toBe("offline edit");
  test.sync.dispose();
});
it("rechecks a competing write instead of forcing an overwrite", async () => {
  vi.useFakeTimers();
  const test = setup();
  test.transport.write = vi.fn(async () => null);
  await test.sync.sync();
  expect(test.status).toHaveBeenLastCalledWith("pending");
  expect(test.values.size).toBe(0);
  test.sync.dispose();
});
it("uses the selected cloud copy and backs up the displaced local copy", async () => {
  const test = setup("local", { payload: "cloud", revision: 3 });
  await test.sync.sync();
  await test.sync.resolve("cloud");
  expect(test.apply).toHaveBeenCalledWith("cloud");
  expect(test.transport.write).not.toHaveBeenCalled();
  expect([...test.values.values()].some(value => value.includes('"local":"local"'))).toBe(true);
  test.sync.dispose();
});
