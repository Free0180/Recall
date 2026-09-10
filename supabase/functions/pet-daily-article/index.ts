import { PET_STUDY_WORDS } from "../../../src/pet/pet-words.ts";
import { validateArticle, type DailyArticle } from "../../../src/pet/study-article.ts";

declare const Deno: { env: { get: (name: string) => string | undefined }; serve: (handler: (request: Request) => Promise<Response>) => void };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const wordMap = new Map(PET_STUDY_WORDS.map((word) => [word.id, word]));
const systemPrompt = `You are an English teacher writing original Cambridge B1 Preliminary (PET) practice for school-age learners.
Return JSON only: {"title":"...","paragraphs":["...","...","..."],"grammar":[{"label":"Chinese grammar name","example":"An exact sentence copied from the article.","explanation":"A clear explanation in Chinese."}]}.
Write ONE complete, coherent, age-appropriate story with a beginning, middle and ending. Use natural British English at CEFR B1. Do not concatenate unrelated vocabulary example sentences.
Use EVERY supplied target word naturally in the body, at least once in its EXACT spelling (case-insensitive), with the supplied meaning. Do not just list words or discuss a vocabulary list.
Write 3-6 paragraphs and about 150-300 words for up to 10 target words, 250-600 for more. Use at least three B1 grammar points such as past simple with past continuous, present perfect, a first conditional, or a defining relative clause.
Provide 3 grammar notes, with verbatim example sentences from the story and accurate Chinese explanations. Do not claim to be an official exam or reproduce published texts. Check the grammar and coverage before returning JSON.`;

export function createArticleHandler(getEnv: (name: string) => string | undefined, requestFetch: typeof fetch = fetch): (request: Request) => Promise<Response> {
  // Warm-instance deduplication reduces accidental repeat requests. This is not a global billing limit.
  const cache = new Map<string, { expires: number; result: Promise<DailyArticle> }>();
  const usage = new Map<string, { day: string; count: number }>();
  const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const apiKey = getEnv("PET_AI_API_KEY");
    const baseUrl = getEnv("PET_AI_BASE_URL");
    const model = getEnv("PET_AI_MODEL");
    if (!supabaseUrl || !anonKey || !apiKey || !baseUrl || !model) return json({ error: "service_not_configured" }, 503);
    try {
      const authResponse = await requestFetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: anonKey }, signal: AbortSignal.timeout(10_000) });
      if (!authResponse.ok) return json({ error: "unauthorized" }, 401);
      const user = await authResponse.json() as { id?: string; email?: string };
      if (!user.id || !/^(free[12]|run(?:[1-9]|10))@pet-vocab\.invalid$/i.test(user.email ?? "")) return json({ error: "unauthorized" }, 401);
      const bodyText = await request.text();
      if (bodyText.length > 4096) return json({ error: "request_too_large" }, 413);
      let body: { date?: unknown; wordIds?: unknown };
      try { body = JSON.parse(bodyText); } catch { return json({ error: "invalid_request" }, 400); }
      if (!body || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
        || !Array.isArray(body.wordIds) || body.wordIds.length < 1 || body.wordIds.length > 30
        || body.wordIds.some((id) => !Number.isInteger(id) || !wordMap.has(id))
        || new Set(body.wordIds).size !== body.wordIds.length) return json({ error: "invalid_words" }, 400);
      const words = (body.wordIds as number[]).map((id) => wordMap.get(id)!);
      const now = Date.now();
      for (const [key, entry] of cache) if (entry.expires < now) cache.delete(key);
      const cacheKey = `${user.id}:${body.date}:${words.map((word) => word.id).sort((a, b) => a - b).join(",")}`;
      const existing = cache.get(cacheKey);
      if (existing) return json({ article: await existing.result });
      const utcDay = new Date().toISOString().slice(0, 10);
      for (const [key, entry] of usage) if (entry.day !== utcDay) usage.delete(key);
      const used = usage.get(user.id)?.count ?? 0;
      if (used >= 20) return json({ error: "too_many_requests" }, 429);
      usage.set(user.id, { day: utcDay, count: used + 1 });
      const result = (async () => {
        const response = await requestFetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, response_format: { type: "json_object" }, max_tokens: 3000,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify({ vocabulary: words.map((word) => ({ word: word.word, meaning: word.meaning, partOfSpeech: word.partOfSpeech })) }) }] }),
          signal: AbortSignal.timeout(75_000),
        });
        if (!response.ok) throw new Error("provider_error");
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content || content.length > 30_000) throw new Error("invalid_article");
        return validateArticle(JSON.parse(content), words.map((word) => word.word));
      })();
      cache.set(cacheKey, { result, expires: now + 3_600_000 });
      try { return json({ article: await result }); }
      catch { cache.delete(cacheKey); return json({ error: "article_generation_failed" }, 502); }
    } catch {
      return json({ error: "service_unavailable" }, 502);
    }
  };
}

if (typeof Deno !== "undefined") Deno.serve(createArticleHandler((name) => Deno.env.get(name)));
