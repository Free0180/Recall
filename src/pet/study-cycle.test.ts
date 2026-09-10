import { describe, expect, it } from "vitest";
import { addDays, currentStudyDay, dictationCount, ensureSchedule, normaliseSpelling, readSchedule, schedulePosition, updateStudyDay, wordsComplete, type Rating } from "./study-cycle";
import { PET_STUDY_WORDS } from "./pet-words";

describe("seven calendar day study cycle", () => {
  it("carries unresolved words across cycles, merges new weak words, and drops mastered words", () => {
    let schedule = ensureSchedule(null, {}, "2026-09-09");
    schedule = updateStudyDay(schedule, 1, 0, day => ({ ...day, ratings: { 1: "again", 2: "learning" } }));
    schedule = ensureSchedule(schedule, { 1: "again", 2: "learning" }, "2026-09-14");
    schedule = updateStudyDay(schedule, 1, 5, day => ({ ...day, ratings: { 1: "known" } }));
    // Day seven was missed. Day one of the next cycle adds a different weak word.
    schedule = ensureSchedule(schedule, { 1: "known", 2: "learning" }, "2026-09-16");
    const newId = schedule.cycles[1].days[0].wordIds[0];
    schedule = updateStudyDay(schedule, 2, 0, day => ({ ...day, ratings: { [newId]: "again" } }));
    const ratings: Record<number, Rating> = { 1: "known", 2: "learning", [newId]: "again" };
    schedule = ensureSchedule(schedule, ratings, "2026-09-21");
    expect(schedule.cycles[1].days[5].wordIds).toEqual([newId]);
    expect(schedule.cycles[1].days[6].wordIds).toEqual([2]);
    const history = JSON.stringify(schedule.cycles);
    // Skip two entire cycles: unresolved words still survive, once each.
    const later = ensureSchedule(schedule, ratings, "2026-10-12");
    expect(later.cycles.at(-1)!.days.slice(5).flatMap(day => day.wordIds)).toEqual([newId, 2]);
    expect(JSON.stringify(later.cycles.slice(0, -1))).toBe(history);
    const mastered = ensureSchedule(later, { 1: "known", 2: "known", [newId]: "known" }, "2026-10-19");
    expect(mastered.cycles.at(-1)!.days.slice(5).flatMap(day => day.wordIds)).toEqual([]);
  });

  it("excludes unstudied words and applied known choices from cross-cycle reviews", () => {
    let schedule = ensureSchedule(null, {}, "2026-09-09", { 1: "unknown", 2: "unknown", 3: "unknown" });
    schedule = updateStudyDay(schedule, 1, 0, day => ({ ...day, ratings: { 1: "again", 2: "learning" } }));
    schedule = ensureSchedule(schedule, { 1: "again", 2: "learning" }, "2026-09-21", { 1: "known", 2: "unknown", 3: "unknown" });
    expect(schedule.cycles.at(-1)!.days.slice(5).flatMap(day => day.wordIds)).toEqual([2]);
  });

  it("defaults to ten new words daily, without inventing new words after the library is exhausted", () => {
    const schedule = ensureSchedule(null, {}, "2026-09-09");
    expect(schedule.dailyTarget).toBe(10);
    expect(schedule.cycles[0].days.map((day) => day.wordIds.length)).toEqual([10, 10, 10, 0, 0, 0, 0]);
    expect(new Set(schedule.cycles[0].days.flatMap((day) => day.wordIds)).size).toBe(30);
    expect(schedule.cycles[0].reviewPlanned).toBe(false);
    expect(schedulePosition(schedule, "2026-09-14")).toEqual({ cycleNumber: 1, dayIndex: 5 });
    expect(schedulePosition(schedule, "2026-09-16")).toEqual({ cycleNumber: 2, dayIndex: 0 });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("splits only rated weak words, prioritises unknowns and freezes both review batches", () => {
    let schedule = ensureSchedule(null, {}, "2026-09-09");
    const ids = schedule.cycles[0].days[0].wordIds;
    const ratings: Record<number, Rating> = { [ids[0]]: "learning", [ids[1]]: "again", [ids[2]]: "known", [ids[3]]: "learning", [ids[4]]: "again" };
    schedule = updateStudyDay(schedule, 1, 0, (day) => ({ ...day, ratings }));
    schedule = ensureSchedule(schedule, ratings, "2026-09-14");
    const days = schedule.cycles[0].days;
    expect(days[5].wordIds).toEqual([ids[1], ids[4]]);
    expect(days[6].wordIds).toEqual([ids[0], ids[3]]);
    schedule = updateStudyDay(schedule, 1, 5, (day) => ({ ...day, ratings: { [ids[1]]: "known", [ids[4]]: "again" } }));
    schedule = ensureSchedule(schedule, { ...ratings, [ids[1]]: "known" }, "2026-09-15");
    expect(currentStudyDay(schedule, "2026-09-15").day.wordIds).toEqual([ids[0], ids[3]]);
  });

  it("handles an odd count, missing day six, and an empty review pool", () => {
    let schedule = ensureSchedule(null, {}, "2026-09-09");
    const [id] = schedule.cycles[0].days[0].wordIds;
    schedule = updateStudyDay(schedule, 1, 0, (day) => ({ ...day, ratings: { [id]: "again" } }));
    schedule = ensureSchedule(schedule, { [id]: "again" }, "2026-09-15");
    expect(schedule.cycles[0].days[5].wordIds).toEqual([id]);
    expect(schedule.cycles[0].days[6].wordIds).toEqual([]);
    const empty = ensureSchedule(ensureSchedule(null, {}, "2026-09-09"), {}, "2026-09-14");
    expect(empty.cycles[0].days[5].wordIds).toEqual([]);
    expect(wordsComplete(empty.cycles[0].days[5])).toBe(false);
  });

  it("keeps old progress and assigns only unseen words to the next cycle", () => {
    const first = ensureSchedule(null, {}, "2026-09-09");
    const ratings = Object.fromEntries(PET_STUDY_WORDS.slice(0, 6).map((word) => [word.id, "known"])) as Record<number, Rating>;
    const next = ensureSchedule(first, ratings, "2026-09-16");
    expect(next.cycles).toHaveLength(2);
    expect(next.cycles[1].days[0].wordIds[0]).toBe(PET_STUDY_WORDS[6].id);
    expect(next.cycles[0]).toEqual(first.cycles[0]);
  });

  it("requires each assigned word once, and counts only correct dictation", () => {
    const schedule = ensureSchedule(null, {}, "2026-09-09");
    const day = schedule.cycles[0].days[0];
    day.ratings[day.wordIds[0]] = "again";
    expect(wordsComplete(day)).toBe(false);
    day.wordIds.forEach((id) => { day.ratings[id] = "learning"; });
    expect(wordsComplete(day)).toBe(true);
    day.dictation[day.wordIds[0]] = { answer: "ABILITY", correct: true, attempts: 2 };
    day.dictation[day.wordIds[1]] = { answer: "achive", correct: false, attempts: 1 };
    expect(dictationCount(day)).toBe(1);
    expect(normaliseSpelling("  ABILITY  ")).toBe("ability");
    expect(normaliseSpelling("ab ility")).not.toBe("ability");
    expect(readSchedule(JSON.parse(JSON.stringify(schedule)))).toEqual(schedule);
    expect(readSchedule({ version: 1, startDate: "2026-02-31", dailyTarget: 6, cycles: [] })).toBeNull();
    expect(readSchedule(undefined)).toBeNull();
  });
});
