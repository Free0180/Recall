export interface CloudSnapshot { revision: number; payload: string }
export interface CloudTransport {
  read(): Promise<CloudSnapshot | null>;
  write(payload: string, revision: number): Promise<CloudSnapshot | null>;
}
export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "conflict" | "error";
interface Cache { base: CloudSnapshot | null; local: string }

// A durable outbox and compare-and-swap protocol. Never resolve concurrent edits
// by a device clock: both full copies remain available for an explicit choice.
export class CloudSync {
  private cache: Cache;
  private busy = false;
  private disposed = false;
  private conflict: CloudSnapshot | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private key: string,
    initial: string,
    private empty: (payload: string) => boolean,
    private storage: Pick<Storage, "getItem" | "setItem">,
    private transport: CloudTransport,
    private apply: (payload: string) => void,
    private status: (status: SyncStatus) => void,
  ) {
    this.cache = { base: null, local: initial };
    const saved = storage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as Cache;
      if (typeof parsed.local !== "string" || (parsed.base !== null && (!Number.isSafeInteger(parsed.base?.revision) || typeof parsed.base?.payload !== "string"))) throw new Error("Invalid sync cache");
      this.cache = parsed;
      // Outbox is authoritative after a crash between the two local writes.
      if (parsed.local !== initial) apply(parsed.local);
    }
  }
  private save(): void { this.storage.setItem(this.key, JSON.stringify(this.cache)); }
  stage(payload: string): void {
    if (this.disposed || this.cache.local === payload) return;
    this.cache.local = payload;
    this.save();
    this.status(this.conflict ? "conflict" : "pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), 1000);
  }
  async sync(): Promise<void> {
    if (this.disposed || this.busy || this.conflict) return;
    this.busy = true;
    this.status("syncing");
    try {
      const remote = await this.transport.read();
      if (this.disposed) return;
      const local = this.cache.local;
      const base = this.cache.base;
      if (remote && remote.payload !== local && remote.revision !== (base?.revision ?? 0)) {
        if ((base && local === base.payload) || (!base && this.empty(local))) {
          // Persist before changing the UI. Storage failure leaves the local copy intact.
          this.storage.setItem(this.key, JSON.stringify({ base: remote, local: remote.payload }));
          this.apply(remote.payload);
          this.cache = { base: remote, local: remote.payload };
          this.status("synced");
          return;
        }
        this.conflict = remote;
        this.status("conflict");
        return;
      }
      if (remote?.payload === local) {
        this.cache.base = remote;
        this.save();
        this.status("synced");
        return;
      }
      // A missing row with an existing baseline must not recreate lost cloud data.
      if (!remote && base) throw new Error("Cloud snapshot missing");
      const result = await this.transport.write(local, remote?.revision ?? 0);
      if (this.disposed) return;
      if (!result) {
        this.status("pending");
        this.timer = setTimeout(() => void this.sync(), 1000);
        return;
      }
      this.cache.base = result;
      this.save();
      this.status(this.cache.local === local ? "synced" : "pending");
      if (this.cache.local !== local) this.timer = setTimeout(() => void this.sync(), 1000);
    } catch { if (!this.disposed) this.status("error"); }
    finally { this.busy = false; }
  }
  async resolve(choice: "local" | "cloud"): Promise<void> {
    const remote = this.conflict;
    if (!remote || this.busy || this.disposed) return;
    try {
      // Keep both versions before either decision, including a new local edit.
      this.storage.setItem(`${this.key}-conflict-${Date.now()}`, JSON.stringify({ local: this.cache.local, cloud: remote }));
      this.cache.base = remote;
      if (choice === "cloud") {
        this.cache.local = remote.payload;
        this.save();
        this.apply(remote.payload);
      } else this.save();
      this.conflict = null;
      await this.sync();
    } catch { this.status("error"); }
  }
  dispose(): void { this.disposed = true; clearTimeout(this.timer); }
}
