import { expect, it } from "vitest";
import { validateArticle } from "./study-article";
import { dailyArticleFixture } from "../../e2e/fixtures/daily-article";

it("accepts complete articles with all exact target words and grounded grammar notes", () => {
  expect(validateArticle(dailyArticleFixture, dailyArticleFixture.focusWords).focusWords).toEqual(dailyArticleFixture.focusWords);
});
it("rejects missing vocabulary, short text, invalid grammar and non-JSON structures", () => {
  expect(() => validateArticle(dailyArticleFixture, ["volunteer"])).toThrow("未覆盖");
  expect(() => validateArticle({ ...dailyArticleFixture, paragraphs: ["First.", "Next.", "Finally."] }, [])).toThrow("长度");
  expect(() => validateArticle({ ...dailyArticleFixture, grammar: [{ label: "Past", example: "Invented sentence.", explanation: "Past tense" }, ...dailyArticleFixture.grammar] }, [])).toThrow("语法");
  expect(() => validateArticle(null, [])).toThrow("格式");
});
