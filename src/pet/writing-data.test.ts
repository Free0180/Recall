import { expect, it } from "vitest";
import { createAttempt, importFeedback, readWritingBackup, reviewMaterials, validAttempt, wordCount, writingBackup } from "./writing-data";

it("exports full context and exact identifiers without inventing handwritten text", () => {
  const a = createAttempt("email-visit"); a.minutes = "20";
  const material = reviewMaterials(a);
  expect(material).toContain("Suggest a time and a place");
  expect(material).toContain("20 分钟");
  expect(material).toContain("请勿根据题目猜测内容");
  expect(material).toContain(a.id);
  expect(material).toContain('"taskId": "email-visit"');
});
it("accepts correctly matched feedback and rejects another essay's feedback", () => {
  const a = createAttempt("email-visit");
  const input = { kind: "pet-writing-feedback", version: 1, attemptId: a.id, taskId: a.taskId, feedback: "补充见面时间。", revisionFeedback: "" };
  expect(importFeedback(JSON.stringify(input), a).feedback).toBe("补充见面时间。");
  expect(() => importFeedback(JSON.stringify({ ...input, attemptId: "another" }), a)).toThrow("不属于当前作文");
  expect(() => importFeedback(JSON.stringify({ ...input, feedback: {} }), a)).toThrow("点评格式不正确");
});
it("round-trips photos and preserves first and revised drafts in an account backup", () => {
  const a = createAttempt("email-visit"); a.original = "It not far."; a.revision = "It is not far.";
  a.photos = [{ name: "page.jpg", data: "data:image/jpeg;base64,YQ==" }];
  expect(readWritingBackup(writingBackup("RUN1", [a]), "RUN1")).toEqual([a]);
  expect(() => readWritingBackup(writingBackup("RUN1", [a]), "RUN2")).toThrow("当前账号");
});
it("rejects malformed, oversized and active-image backup content", () => {
  const a = createAttempt("email-visit");
  expect(validAttempt(a)).toBe(true);
  expect(validAttempt({ ...a, original: "a".repeat(12001) })).toBe(false);
  expect(validAttempt({ ...a, photos: [{ name: "page.svg", data: "data:image/svg+xml;base64,YQ==" }] })).toBe(false);
  expect(() => readWritingBackup(writingBackup("RUN1", [a, a]), "RUN1")).toThrow("格式不正确");
});
it("counts English words without inflating counts for punctuation or Chinese notes", () => {
  expect(wordCount("Dear Alex, I'm excited! 我的记录" )).toBe(4);
  expect(wordCount("")).toBe(0);
});
