import { PET_STUDY_WORDS } from "./pet-words";
import type { DailyArticle } from "./study-article";

export type Rating = "again" | "learning" | "known";
export type VocabularyStatus = "known" | "unknown";
export type VocabularyChoices = Record<number, VocabularyStatus>;
export interface DictationResult {
  answer: string;
  correct: boolean;
  attempts: number;
}
export interface StudyDay {
  wordIds: number[];
  ratings: Record<number, Rating>;
  dictation: Record<number, DictationResult>;
  article?: DailyArticle;
}
export interface StudyCycle {
  number: number;
  startDate: string;
  dailyTarget: number;
  reviewPlanned: boolean;
  days: StudyDay[];
}
export interface StudySchedule {
  version: 1;
  startDate: string;
  dailyTarget: number;
  cycles: StudyCycle[];
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function schedulePosition(schedule: StudySchedule, today: string): { cycleNumber: number; dayIndex: number } {
  const elapsed = Math.max(0, Math.floor(dayNumber(today) - dayNumber(schedule.startDate)));
  return { cycleNumber: Math.floor(elapsed / 7) + 1, dayIndex: elapsed % 7 };
}

export function ensureSchedule(previous: StudySchedule | null, ratings: Record<number, Rating>, today: string, choices?: VocabularyChoices, pool = PET_STUDY_WORDS): StudySchedule {
  let schedule: StudySchedule = previous ?? { version: 1, startDate: today, dailyTarget: 10, cycles: [] };
  const { cycleNumber, dayIndex } = schedulePosition(schedule, today);
  let cycle = schedule.cycles.find((item) => item.number === cycleNumber);
  if (!cycle) {
    const newWords = pool.filter((word) => !ratings[word.id] && (!choices || choices[word.id] === "unknown"));
    cycle = {
      number: cycleNumber,
      startDate: addDays(schedule.startDate, (cycleNumber - 1) * 7),
      dailyTarget: schedule.dailyTarget,
      reviewPlanned: false,
      days: Array.from({ length: 7 }, (_, index) => ({
        wordIds: index < 5 ? newWords.slice(index * schedule.dailyTarget, (index + 1) * schedule.dailyTarget).map((word) => word.id) : [],
        ratings: {},
        dictation: {},
      })),
    };
    schedule = { ...schedule, cycles: [...schedule.cycles, cycle] };
  }
  // Rebuild only unstudied new-word slots; completed work and past dates stay intact.
  if (choices && dayIndex < 5) {
    const protectedIds = new Set(cycle.days.flatMap((day, index) => index < dayIndex || wordsComplete(day) ? day.wordIds : day.wordIds.filter(id => day.ratings[id])));
    const candidates = pool.filter(word => choices[word.id] === "unknown" && !ratings[word.id] && !protectedIds.has(word.id)).map(word => word.id);
    let offset = 0;
    const days = cycle.days.map((day, index) => {
      if (index < dayIndex || index >= 5 || wordsComplete(day)) return day;
      const done = day.wordIds.filter(id => day.ratings[id]);
      const count = Math.max(0, cycle!.dailyTarget - done.length);
      const wordIds = [...done, ...candidates.slice(offset, offset + count)];
      offset += count;
      return wordIds.join(",") === day.wordIds.join(",") ? day : { ...day, wordIds, article: undefined };
    });
    if (days.some((day, index) => day !== cycle!.days[index])) {
      cycle = { ...cycle, days };
      schedule = { ...schedule, cycles: schedule.cycles.map(item => item.number === cycleNumber ? cycle! : item) };
    }
  }
  if (dayIndex >= 5 && !cycle.reviewPlanned) {
    const firstFiveRatings = Object.assign({}, ...cycle.days.slice(0, 5).map((day) => day.ratings)) as Record<number, Rating>;
    const candidates = [...new Set(cycle.days.slice(0, 5).flatMap((day) => day.wordIds))]
      .filter((id) => (firstFiveRatings[id] === "again" || firstFiveRatings[id] === "learning") && (!choices || choices[id] === "unknown"))
      .sort((left, right) => Number(firstFiveRatings[left] !== "again") - Number(firstFiveRatings[right] !== "again"));
    const split = Math.ceil(candidates.length / 2);
    const days = cycle.days.map((day, index) => index < 5 ? day : { ...day, wordIds: index === 5 ? candidates.slice(0, split) : candidates.slice(split) });
    const nextCycle = { ...cycle, reviewPlanned: true, days };
    schedule = { ...schedule, cycles: schedule.cycles.map((item) => item.number === cycleNumber ? nextCycle : item) };
  }
  if (choices && dayIndex >= 5) {
    schedule = { ...schedule, cycles: schedule.cycles.map(item => item.number !== cycleNumber ? item : {
      ...item, days: item.days.map((day, index) => {
        if (index < dayIndex || wordsComplete(day)) return day;
        const wordIds = day.wordIds.filter(id => day.ratings[id] || choices[id] === "unknown");
        return wordIds.length === day.wordIds.length ? day : { ...day, wordIds };
      }),
    }) };
  }
  return schedule;
}

export function currentStudyDay(schedule: StudySchedule, today: string): { cycle: StudyCycle; day: StudyDay; dayIndex: number } {
  const { cycleNumber, dayIndex } = schedulePosition(schedule, today);
  const cycle = schedule.cycles.find((item) => item.number === cycleNumber)!;
  return { cycle, day: cycle.days[dayIndex], dayIndex };
}

export function updateStudyDay(schedule: StudySchedule, cycleNumber: number, dayIndex: number, update: (day: StudyDay) => StudyDay): StudySchedule {
  return { ...schedule, cycles: schedule.cycles.map((cycle) => cycle.number !== cycleNumber ? cycle : {
    ...cycle, days: cycle.days.map((day, index) => index === dayIndex ? update(day) : day),
  }) };
}

export function studiedCount(day: StudyDay): number {
  return day.wordIds.filter((id) => day.ratings[id]).length;
}

export function wordsComplete(day: StudyDay): boolean {
  return day.wordIds.length > 0 && studiedCount(day) === day.wordIds.length;
}

export function dictationCount(day: StudyDay): number {
  return day.wordIds.filter((id) => day.dictation[id]?.correct).length;
}

export function normaliseSpelling(answer: string): string {
  return answer.normalize("NFKC").trim().toLowerCase();
}

// Imported backups may predate cycles. Invalid cycle data falls back to a new schedule.
export function readSchedule(value: unknown, pool = PET_STUDY_WORDS): StudySchedule | null {
  if (!value || typeof value !== "object") return null;
  const schedule = value as StudySchedule;
  const isDate = (date: unknown): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dayNumber(date)) && addDays(date, 0) === date;
  const validTarget = (target: number): boolean => Number.isInteger(target) && target >= 1 && target <= 30;
  const isRecord = (record: unknown): record is Record<string, unknown> => Boolean(record && typeof record === "object" && !Array.isArray(record));
  const validIds = new Set(pool.map((word) => word.id));
  if (schedule.version !== 1 || !isDate(schedule.startDate) || !validTarget(schedule.dailyTarget) || !Array.isArray(schedule.cycles)) return null;
  const valid = schedule.cycles.every((cycle) => cycle && Number.isInteger(cycle.number) && cycle.number > 0 && isDate(cycle.startDate)
    && validTarget(cycle.dailyTarget) && typeof cycle.reviewPlanned === "boolean" && Array.isArray(cycle.days) && cycle.days.length === 7
    && cycle.days.every((day) => day && Array.isArray(day.wordIds) && day.wordIds.every((id) => validIds.has(id))
      && isRecord(day.ratings) && Object.values(day.ratings).every((rating) => ["again", "learning", "known"].includes(rating))
      && isRecord(day.dictation) && Object.values(day.dictation).every((result) => result && typeof result.answer === "string" && typeof result.correct === "boolean" && Number.isInteger(result.attempts))
      && (!day.article || (typeof day.article.title === "string" && Array.isArray(day.article.paragraphs) && day.article.paragraphs.every((paragraph) => typeof paragraph === "string") && Array.isArray(day.article.focusWords) && day.article.focusWords.every((word) => typeof word === "string") && Array.isArray(day.article.grammar) && day.article.grammar.every((point) => point && typeof point.label === "string" && typeof point.example === "string" && typeof point.explanation === "string")))));
  return valid ? schedule : null;
}
