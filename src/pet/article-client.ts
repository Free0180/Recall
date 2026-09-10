import { petArticleConnection } from "./pet-auth";
import { validateArticle, type DailyArticle } from "./study-article";
import { PET_STUDY_WORDS } from "./pet-words";

const inFlight = new Map<string, Promise<DailyArticle>>();

export function generateDailyArticle(username: string, date: string, wordIds: number[]): Promise<DailyArticle> {
  const key = `${username}:${date}:${wordIds.join(",")}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = (async () => {
    if (!wordIds.length) throw new Error("当天没有单词，无需生成文章");
    const connection = await petArticleConnection();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(connection.url, {
        method: "POST",
        headers: { ...connection.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ date, wordIds }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("登录已过期，请重新登录后生成文章");
        if (response.status === 429) throw new Error("生成请求较多，请稍后重试");
        if (response.status === 404 || response.status === 503) throw new Error("文章服务尚未就绪，请管理员部署云函数并配置 AI 服务");
        throw new Error("文章生成失败，请稍后重试；学习记录已保存");
      }
      const data = await response.json() as { article?: unknown };
      const words = wordIds.map((id) => PET_STUDY_WORDS.find((word) => word.id === id)!.word);
      return validateArticle(data.article, words);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("生成超时，请稍后重试；学习记录已保存", { cause: error });
      if (error instanceof TypeError) throw new Error("网络连接失败，请联网后重试；听写仍可继续", { cause: error });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })();
  inFlight.set(key, request);
  void request.finally(() => inFlight.delete(key)).catch(() => undefined);
  return request;
}
