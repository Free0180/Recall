import { expect, it } from "vitest";
import { generateOfflineArticle } from "./offline-article";
import { PET_STUDY_WORDS } from "./pet-words";
import { validateArticle } from "./study-article";

it("creates a complete offline story for every target word and the entire library", () => {
  for (const ids of [...PET_STUDY_WORDS.map((word) => [word.id]), PET_STUDY_WORDS.map((word) => word.id)]) {
    const article = generateOfflineArticle(ids, "2026-09-10");
    expect(article.source).toBe("offline");
    expect(article.paragraphs).toHaveLength(3);
    expect(validateArticle(article, article.focusWords).focusWords).toHaveLength(ids.length);
  }
});

it("produces stable text for the same date and word list, including dynamic review subsets", () => {
  const first = generateOfflineArticle([3, 7, 12, 26], "2026-09-10");
  expect(first.paragraphs).toEqual(generateOfflineArticle([3, 7, 12, 26], "2026-09-10").paragraphs);
  expect(() => generateOfflineArticle([], "2026-09-10")).toThrow();
  expect(() => generateOfflineArticle([999], "2026-09-10")).toThrow();
});

it("keeps default ten-word lessons between 100 and 140 words", () => {
  for (let start = 0; start < PET_STUDY_WORDS.length; start += 10) {
    const article = generateOfflineArticle(PET_STUDY_WORDS.slice(start, start + 10).map(word => word.id), "2026-09-10");
    const length = article.paragraphs.join(" ").match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length ?? 0;
    expect(length).toBeGreaterThanOrEqual(100);
    expect(length).toBeLessThanOrEqual(140);
    expect(article.offlineVersion).toBe(2);
  }
});
