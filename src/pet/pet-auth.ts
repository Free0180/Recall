import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type PetRole = "admin" | "learner";

export interface PetUser {
  username: string;
  role: PetRole;
}

export interface PetAuthResult {
  user: PetUser | null;
  error: string | null;
}

const TEST_SESSION_KEY = "pet-vocab-e2e-session";
const AUTH_EMAIL_DOMAIN = "pet-vocab.invalid";
const TEST_AUTH_ENABLED = import.meta.env.DEV && import.meta.env.VITE_PET_E2E_AUTH === "1";

export const PET_USERS: PetUser[] = [
  { username: "FREE1", role: "admin" },
  { username: "FREE2", role: "admin" },
  ...Array.from({ length: 10 }, (_, index) => ({
    username: `RUN${index + 1}`,
    role: "learner" as const,
  })),
];

const petUsersByName = new Map(PET_USERS.map((user) => [user.username, user]));
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isPetAuthConfigured = TEST_AUTH_ENABLED || Boolean(supabaseUrl && supabasePublishableKey);

const supabase: SupabaseClient | null = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storageKey: "pet-vocab-supabase-auth-v1",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Reuse Auth's session; never create a second client or accept a caller-supplied user ID.
export function petCloudClient(): SupabaseClient | null {
  return TEST_AUTH_ENABLED ? null : supabase;
}

function normalizeUsername(username: string): string {
  return username.trim().toUpperCase();
}

function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

function userFromSession(session: Session | null): PetUser | null {
  const email = session?.user.email?.toLowerCase();
  if (!email?.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) return null;
  const username = email.slice(0, -(`@${AUTH_EMAIL_DOMAIN}`.length)).toUpperCase();
  return petUsersByName.get(username) ?? null;
}

export async function authenticatePetUser(username: string, password: string): Promise<PetAuthResult> {
  const normalized = normalizeUsername(username);
  const expectedUser = petUsersByName.get(normalized);

  if (!expectedUser || !password) return { user: null, error: "用户名或密码不正确" };

  if (TEST_AUTH_ENABLED) {
    if (password !== "e2e-test-only-password") return { user: null, error: "用户名或密码不正确" };
    localStorage.setItem(TEST_SESSION_KEY, normalized);
    return { user: expectedUser, error: null };
  }

  if (!supabase) return { user: null, error: "安全登录尚未配置，请联系管理员" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(normalized),
    password,
  });

  if (error) return { user: null, error: "用户名或密码不正确" };

  const user = userFromSession(data.session);
  if (!user) {
    await supabase.auth.signOut();
    return { user: null, error: "此账号没有使用权限" };
  }

  return { user, error: null };
}

export async function loadPetSession(): Promise<PetUser | null> {
  if (TEST_AUTH_ENABLED) {
    const username = localStorage.getItem(TEST_SESSION_KEY);
    return username ? petUsersByName.get(username) ?? null : null;
  }
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  return error ? null : userFromSession(data.session);
}

export function subscribePetSession(onChange: (user: PetUser | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(userFromSession(session)));
  return () => data.subscription.unsubscribe();
}

export async function clearPetSession(): Promise<void> {
  if (TEST_AUTH_ENABLED) {
    localStorage.removeItem(TEST_SESSION_KEY);
    return;
  }
  if (supabase) await supabase.auth.signOut();
}

export async function updatePetPassword(password: string): Promise<string | null> {
  if (TEST_AUTH_ENABLED) return null;
  if (!supabase) return "安全登录尚未配置";
  const { error } = await supabase.auth.updateUser({ password });
  return error ? "密码修改失败，请稍后再试" : null;
}

export async function petArticleConnection(): Promise<{ url: string; headers: Record<string, string> }> {
  if (TEST_AUTH_ENABLED) return { url: "/__pet_test_article", headers: {} };
  if (!supabase || !supabaseUrl || !supabasePublishableKey) throw new Error("文章服务尚未配置，请联系管理员");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("登录已过期，请重新登录后生成文章");
  return {
    url: `${supabaseUrl}/functions/v1/pet-daily-article`,
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: supabasePublishableKey },
  };
}
