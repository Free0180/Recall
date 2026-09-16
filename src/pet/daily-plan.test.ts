import { describe, expect, it } from "vitest";
import { emptyPlans, exportDay, localDay, makeDay, parseDailyFeedback, phaseFor, reconcileDay, validDaily } from "./daily-plan";
import { freshPrep, validPrep, readPrepBackup } from "./preparation-data";
import { blankLesson } from "./course-data";

describe("daily study plans and external feedback",()=>{
  it("allocates weekday/weekend budgets and switches phases at the configured date",()=>{
    const s=freshPrep(),p=emptyPlans(s.examMonth);
    expect(p.sprintStart).toBe("2027-01-01");
    expect(phaseFor("2026-12-31",p)).toBe("foundation");expect(phaseFor("2027-01-01",p)).toBe("sprint");
    expect(makeDay("2026-09-16",s,p).tasks.reduce((n,t)=>n+t.minutes,0)).toBe(60);
    const weekend=makeDay("2026-09-19",s,p);expect(weekend.tasks.reduce((n,t)=>n+t.minutes,0)).toBe(120);expect(weekend.tasks.some(t=>t.kind==="writing")).toBe(true);
    expect(makeDay("2027-01-04",s,p).tasks.map(t=>t.minutes)).toEqual([10,35,15]);
    expect(makeDay("2026-09-17",s,p).tasks.every(t=>!t.done)).toBe(true);
  });
  it("does not mark a page visit complete or backfill yesterday with today's submission",()=>{
    const s=freshPrep(),p=emptyPlans(s.examMonth),day=makeDay(localDay(),s,p);
    day.tasks[1]={...day.tasks[1],kind:"grammar",target:"c-be",baseline:""};
    expect(reconcileDay(day,s,[],[]).tasks[1].done).toBe(false);
    const next={...s,lessons:{"c-be":{...blankLesson(),checked:true,submitted:true,original:"My work"}}};
    expect(reconcileDay(day,next,[],[]).tasks[1].done).toBe(true);
    expect(reconcileDay({...day,date:"2020-01-01"},next,[],[]).tasks[1].done).toBe(false);
    expect(reconcileDay(day,s,[{date:day.date,text:"No tasks",complete:false}],[]).tasks[0].done).toBe(false);
  });
  it("matches account, date, export version and every task ID before importing",()=>{
    const s=freshPrep(),day=makeDay(localDay(),s,emptyPlans(s.examMonth)),packet=exportDay("RUN1",day);day.packages.push(packet);
    const f={kind:"pet-daily-feedback",version:1,username:"RUN1",date:day.date,packageId:packet.id,summary:"Review",tasks:packet.taskIds.map(taskId=>({taskId,feedback:"Add a reason",nextPractice:"Try again"}))};
    expect(parseDailyFeedback('```json\n'+JSON.stringify(f)+'\n```',"RUN1",day)).toEqual(f);
    for(const invalid of [{...f,username:"RUN2"},{...f,date:"2020-01-01"},{...f,packageId:"other"},{...f,tasks:[]},{...f,tasks:[f.tasks[0],f.tasks[0]]}])expect(()=>parseDailyFeedback(JSON.stringify(invalid),"RUN1",day)).toThrow();
    const original=packet.material;day.tasks[0].note="Later edits";expect(packet.material).toBe(original);
    expect(validPrep({...s,daily:{...emptyPlans(s.examMonth),days:{[day.date]:day}}})).toBe(true);
  });
  it("preserves daily feedback in backups while accepting pre-planner backups",()=>{
    const state=freshPrep();expect(validPrep(state)).toBe(true);
    const day=makeDay(localDay(),state,emptyPlans(state.examMonth));const data={...state,daily:{...emptyPlans(state.examMonth),days:{[day.date]:day}}};
    expect(readPrepBackup(JSON.stringify({kind:"pet-preparation",version:1,username:"RUN1",data}),"RUN1").daily).toEqual(data.daily);
    expect(validDaily({...data.daily,days:{"2027-02-30":day}})).toBe(false);
    expect(validDaily({...data.daily,days:{[day.date]:{...day,tasks:[day.tasks[0],day.tasks[0]]}}})).toBe(false);
  });
});
