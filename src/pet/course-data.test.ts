import { describe, expect, it } from "vitest";
import { blankLesson, LESSONS, lessonMaterials, validLessons } from "./course-data";
import { freshPrep, readPrepBackup, validPrep } from "./preparation-data";

describe("course content and persistence", () => {
  it("retains older preparation backups and preserves course drafts in new backups", () => {
    expect(validPrep(freshPrep())).toBe(true);
    const work={...blankLesson(),sentence:"My sentence",original:"My paragraph",feedback:"Add a reason",revision:"My revision",submitted:true};
    const data={...freshPrep(),lessons:{"c-be":work}};
    expect(readPrepBackup(JSON.stringify({kind:"pet-preparation",version:1,username:"RUN1",data}),"RUN1").lessons?.["c-be"]).toEqual(work);
    expect(()=>readPrepBackup(JSON.stringify({kind:"pet-preparation",version:1,username:"RUN2",data}),"RUN1")).toThrow();
  });
  it("rejects malformed or oversized course records rather than discarding them", () => {
    expect(validLessons({"c-be":{...blankLesson(),original:"x".repeat(10001)}})).toBe(false);
    expect(validLessons({"c-be":{...blankLesson(),answers:{0:"injected answer"}}})).toBe(false);
    expect(validLessons({"missing":blankLesson()})).toBe(false);
    expect(validPrep({...freshPrep(),lessons:{"c-be":null}})).toBe(false);
  });
  it("provides complete learning sequences with answer explanations and distinct IDs", () => {
    expect(LESSONS.filter(l=>l.kind==="grammar")).toHaveLength(11);
    expect(LESSONS.filter(l=>l.kind==="writing")).toHaveLength(6);
    expect(new Set(LESSONS.map(l=>l.id)).size).toBe(LESSONS.length);
    for(const lesson of LESSONS) {
      expect(lesson.teaching.length).toBeGreaterThanOrEqual(3);
      expect(lesson.examples.length).toBeGreaterThanOrEqual(2);
      for(const q of lesson.questions) {expect(q.choices).toContain(q.answer);expect(q.why.length).toBeGreaterThan(0);}
      const materials=lessonMaterials(lesson,blankLesson());
      expect(materials).toContain(lesson.sentence);expect(materials).toContain(lesson.paragraph);
      expect(materials).not.toContain(lesson.model);
    }
  });
});
