import { describe, expect, it } from "vitest";
import { EXERCISES, firstResults, freshPrep, markExercise, readPrepBackup, unresolvedQuestions, validPrep, weekDays, type Result } from "./preparation-data";
const exercise = EXERCISES.find(e => e.id === "r6")!;
function result(id: string, answers: Record<string,string>): Result { return { id, exerciseId:exercise.id, at:"2026-09-16T08:00:00Z", seconds:80, mode:"check", answers, correct:markExercise(exercise,answers), total:exercise.questions.length, causes:{} }; }
describe("preparation records", () => {
  it("preserves the first diagnostic while resolving mistakes after a correct retry", () => {
    const first=result("first", {r6a:"to",r6b:"what",r6c:"than"});
    const retry=result("retry", {r6a:" FOR ",r6b:"what",r6c:"than"});
    expect(unresolvedQuestions([first]).map(x=>x.question.id)).toEqual(["r6a"]);
    expect(unresolvedQuestions([first,retry])).toEqual([]);
    expect(firstResults([first,retry])).toEqual([first]);
  });
  it("rejects another user's backup and forged marks", () => {
    const data={...freshPrep(),results:[result("first",{r6a:"for"})]};
    const backup=JSON.stringify({kind:"pet-preparation",version:1,username:"RUN1",data});
    expect(readPrepBackup(backup,"RUN1")).toEqual(data);
    expect(()=>readPrepBackup(backup,"RUN2")).toThrow("当前账号");
    expect(validPrep({...data,results:[{...data.results[0],correct:3}]})).toBe(false);
    expect(validPrep({...data,results:[data.results[0],data.results[0]]})).toBe(false);
    expect(validPrep({...data,weekdayMinutes:0})).toBe(false);
  });
  it("offers all six reading and four listening task introductions with distinct question IDs", () => {
    expect(EXERCISES.filter(e=>e.skill==="reading")).toHaveLength(6);
    expect(EXERCISES.filter(e=>e.skill==="listening")).toHaveLength(4);
    const questions=EXERCISES.flatMap(e=>e.questions);
    expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);
    for(const item of questions) { expect(item.evidence.length).toBeGreaterThan(0); if(item.choices)expect(item.choices).toContain(item.answer); }
  });
  it("calculates a Monday-based week across month boundaries without UTC shifts", () => {
    const days=weekDays(new Date(2026,10,1,23));
    expect(days[0].getDay()).toBe(1); expect(days[0].getDate()).toBe(26);
    expect(days[6].getMonth()).toBe(10); expect(days[6].getDate()).toBe(1);
  });
});
