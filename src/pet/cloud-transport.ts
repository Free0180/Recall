import { petCloudClient } from "./pet-auth";
import type { CloudSnapshot, CloudTransport } from "./cloud-sync";

export function createCloudTransport(username: string): CloudTransport | null {
  const client = petCloudClient();
  if (!client) return null;
  async function owner(): Promise<string> {
    const { data, error } = await client!.auth.getSession();
    if (error || data.session?.user.email?.toLowerCase() !== `${username.toLowerCase()}@pet-vocab.invalid`) throw new Error("Session changed");
    return data.session.user.id;
  }
  return {
    async read() {
      const id = await owner();
      const { data, error } = await client.from("pet_learning_snapshots").select("revision,payload").eq("user_id", id).maybeSingle();
      if (error) throw error;
      return data as CloudSnapshot | null;
    },
    async write(payload, revision) {
      const id = await owner();
      const { data, error } = await client.rpc("pet_save_learning", { expected_user: id, expected_revision: revision, next_payload: payload });
      if (error) throw error;
      return data as CloudSnapshot | null;
    },
  };
}
