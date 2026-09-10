export interface DailyArticle {
  offlineVersion?: number;
  source?: "offline" | "ai";
  title: string;
  paragraphs: string[];
  focusWords: string[];
  grammar: Array<{ label: string; example: string; explanation: string }>;
  generatedAt: string;
}

export function validateArticle(value: unknown, words: string[]): DailyArticle {
  if (!value || typeof value !== "object") throw new Error("文章格式不正确，请重试");
  const article = value as DailyArticle;
  if (typeof article.title !== "string" || !article.title.trim() || article.title.length > 160
    || !Array.isArray(article.paragraphs) || article.paragraphs.length < 3 || article.paragraphs.length > 10
    || !article.paragraphs.every((paragraph) => typeof paragraph === "string" && paragraph.trim().length > 0)
    || !Array.isArray(article.grammar) || article.grammar.length < 2 || article.grammar.length > 6) {
    throw new Error("文章不完整，请重试生成");
  }
  const text = article.paragraphs.join(" ");
  const length = text.match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length ?? 0;
  if (length < 100 || length > 900) throw new Error("文章长度不符合要求，请重试");
  const normalise = (value: string): string => ` ${value.toLowerCase().match(/[a-z]+/g)?.join(" ") ?? ""} `;
  if (words.some((word) => !normalise(text).includes(normalise(word)))) throw new Error("文章未覆盖当天所有单词，请重试");
  if (!article.grammar.every((point) => point && typeof point.label === "string" && point.label.length > 0
    && typeof point.example === "string" && point.example.length > 0 && text.includes(point.example)
    && typeof point.explanation === "string" && point.explanation.length > 0 && point.explanation.length < 1000)) {
    throw new Error("文章语法讲解不完整，请重试");
  }
  return { title: article.title, paragraphs: article.paragraphs, grammar: article.grammar, focusWords: [...words], generatedAt: new Date().toISOString() };
}
