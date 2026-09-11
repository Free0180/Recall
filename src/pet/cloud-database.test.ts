// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const learner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const admin = "00000000-0000-0000-0000-000000000003";
const outsider = "00000000-0000-0000-0000-000000000004";
const payload = JSON.stringify({ ratings: { 1: "again", 2: "known" }, reviews: [{ wordId: 1, rating: "again", at: 1 }], speech: { mode: "system", voiceURI: "uk" } });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('${learner}', 'run1@pet-vocab.invalid'), ('${other}', 'run2@pet-vocab.invalid'), ('${admin}', 'free1@pet-vocab.invalid'), ('${outsider}', 'stranger@example.com');`);
  await db.exec(readFileSync("supabase/migrations/202609110001_pet_learning_sync.sql", "utf8"));
}, 30_000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db.close(); });
async function actAs(id: string) {
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
}
async function save(id = learner, revision = 0, body = payload) {
  return (await db.query<{ result: { revision: number } | null }>("select public.pet_save_learning($1, $2, $3) as result", [id, revision, body])).rows[0].result;
}
it("enables RLS on all five tables", async () => {
  const result = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('pet_profiles','pet_learning_snapshots','pet_word_progress','pet_review_records','pet_user_settings')");
  expect(result.rows).toHaveLength(5);
  expect(result.rows.every(row => row.relrowsecurity)).toBe(true);
});
it("writes the snapshot and projections atomically and rejects stale revisions", async () => {
  await actAs(learner);
  expect(await save()).toEqual(expect.objectContaining({ revision: 1 }));
  expect(await save()).toBeNull();
  expect((await db.query("select * from public.pet_word_progress")).rows).toHaveLength(2);
  expect((await db.query("select * from public.pet_review_records")).rows).toHaveLength(1);
  expect((await db.query<{ speech: unknown }>("select speech from public.pet_user_settings")).rows[0].speech).toEqual({ mode: "system", voiceURI: "uk" });
});
it("hides all other users' data including from an admin's direct table reads", async () => {
  await actAs(learner);
  await save();
  await actAs(other);
  for (const table of ["pet_learning_snapshots", "pet_word_progress", "pet_review_records", "pet_user_settings"]) {
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
  }
  await actAs(admin);
  expect((await db.query("select * from public.pet_learning_snapshots")).rows).toHaveLength(0);
  const summary = await db.query<{ username: string; studied: number }>("select * from public.pet_learning_summary()");
  expect(summary.rows.find(row => row.username === "RUN1")?.studied).toBe(2);
});
it("denies anonymous reads", async () => {
  await db.exec("set local role anon");
  await expect(db.query("select * from public.pet_learning_snapshots")).rejects.toThrow(/permission denied/);
});
it("denies anonymous RPC calls", async () => {
  await db.exec("set local role anon");
  await expect(save()).rejects.toThrow(/permission denied/);
});
it("denies writing another account even when a session switches in flight", async () => {
  await actAs(other);
  await expect(save(learner)).rejects.toThrow(/Unauthorized/);
});
it("denies self-enrollment and accounts outside the fixed list", async () => {
  await actAs(outsider);
  await expect(save(outsider)).rejects.toThrow(/not enrolled/);
});
it("denies learner access to admin summaries", async () => {
  await actAs(learner);
  await expect(db.query("select * from public.pet_learning_summary()")).rejects.toThrow(/Admin required/);
});
it("denies client role escalation", async () => {
  await actAs(learner);
  await expect(db.query("update public.pet_profiles set role = 'admin' where user_id = $1", [learner])).rejects.toThrow(/permission denied/);
});
it("denies direct writes that bypass revision checking", async () => {
  await actAs(learner);
  await expect(db.query("insert into public.pet_learning_snapshots(user_id,payload) values ($1,$2)", [learner, payload])).rejects.toThrow(/permission denied/);
});
it("rejects invalid ratings without committing partial projections", async () => {
  await actAs(learner);
  await save();
  await db.exec("savepoint invalid");
  await expect(save(learner, 1, JSON.stringify({ ratings: { 1: "invalid" }, reviews: [] }))).rejects.toThrow();
  await db.exec("rollback to savepoint invalid");
  expect((await db.query<{ revision: number }>("select revision from public.pet_learning_snapshots")).rows[0].revision).toBe(1);
  expect((await db.query("select * from public.pet_word_progress")).rows).toHaveLength(2);
});
