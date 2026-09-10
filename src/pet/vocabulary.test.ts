import { expect, it } from "vitest";
import { ensureSchedule, readSchedule, updateStudyDay } from "./study-cycle";
import { asStudyWord, studyPool } from "./vocabulary";
import { generateOfflineArticle } from "./offline-article";

it("schedules only explicitly unknown words and removes known words from unfinished slots", () => {
  const empty = ensureSchedule(null, {}, "2026-09-10", {});
  expect(empty.cycles[0].days[0].wordIds).toEqual([]);
  const selected = ensureSchedule(empty, {}, "2026-09-10", { 1: "unknown", 2: "unknown", 3: "known" });
  expect(selected.cycles[0].days[0].wordIds).toEqual([1, 2]);
  const removed = ensureSchedule(selected, {}, "2026-09-10", { 1: "known", 2: "unknown" });
  expect(removed.cycles[0].days[0].wordIds).toEqual([2]);
  expect(ensureSchedule(removed, {}, "2026-09-10", { 1: "unknown", 2: "unknown" }).cycles[0].days[0].wordIds).toEqual([1, 2]);
});

it("preserves completed days and fills future slots without duplicates", () => {
  let schedule = ensureSchedule(null, {}, "2026-09-10", { 1: "unknown" });
  schedule = updateStudyDay(schedule, 1, 0, day => ({ ...day, ratings: { 1: "known" }, dictation: { 1: { answer: "ability", correct: true, attempts: 1 } } }));
  const next = ensureSchedule(schedule, { 1: "known" }, "2026-09-10", { 1: "known", 2: "unknown" });
  expect(next.cycles[0].days[0]).toEqual(schedule.cycles[0].days[0]);
  expect(next.cycles[0].days[1].wordIds).toEqual([2]);
  expect(next.cycles[0].days[2].wordIds).toEqual([]);
});

it("persists expanded words and generates their article without a core-only lookup", () => {
  const word = asStudyWord({ word: "abandon", translation_cn: "放弃", part_of_speech: "v.", phonetic: "/əˈbændən/", cefr_level: "B1", difficulty_level: 2, examples: [] }, 0);
  const pool = studyPool([word]);
  const schedule = ensureSchedule(null, {}, "2026-09-10", { [word.id]: "unknown" }, pool);
  expect(schedule.cycles[0].days[0].wordIds).toEqual([1000]);
  expect(readSchedule(JSON.parse(JSON.stringify(schedule)), pool)).toEqual(schedule);
  expect(generateOfflineArticle([1000], "2026-09-10", pool).focusWords).toEqual(["abandon"]);
  expect(asStudyWord({ word: "ability", translation_cn: "能力", part_of_speech: "n.", phonetic: "", cefr_level: "B1", difficulty_level: 2, examples: [] }, 90).id).toBe(1);
});
