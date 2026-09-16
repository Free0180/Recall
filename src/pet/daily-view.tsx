import { useEffect, useRef, useState } from "react";
import { EXERCISES, type PrepState } from "./preparation-data";
import { LESSONS, lessonMaterials } from "./course-data";
import { loadWriting } from "./writing-storage";
import { reviewMaterials, type WritingAttempt } from "./writing-data";
import { defaultSprint, emptyPlans, exportDay, limitEvidence, localDay, makeDay, parseDailyFeedback, reconcileDay, TASK_HELP, TASK_KINDS, TASK_NAMES, taskFor, type DailyFeedback, type DailyTask, type WordEvidence } from "./daily-plan";

export interface DailyViewProps { username:string; today:string; state:PrepState; words:WordEvidence[]; update:(change:(s:PrepState)=>PrepState)=>boolean; onStart:(task:DailyTask)=>void; onSettings:()=>void }
function download(name:string,text:string) { const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }

export function DailyView({username,today,state,words,update,onStart,onSettings}:DailyViewProps) {
  const [selectedDate,setDate]=useState(today); const date=selectedDate>today?today:selectedDate;
  const [writing,setWriting]=useState<WritingAttempt[]>([]);const [writingReady,setWritingReady]=useState(false);
  const [notice,setNotice]=useState("");const [raw,setRaw]=useState("");const [pending,setPending]=useState<DailyFeedback|null>(null);
  const attempted=useRef("");const initialToday=useRef(today);
  const plans=state.daily??emptyPlans(state.examMonth); const day=plans.days[date];
  useEffect(()=>{if(initialToday.current!==today){initialToday.current=today;setDate(today);setPending(null);}},[today]);
  useEffect(()=>{let active=true;void loadWriting(username).then(data=>{if(active){setWriting(data);setWritingReady(true);}}).catch(()=>{if(active)setNotice("写作记录读取失败，暂不能自动归集作文；请在写作页备份原稿后重试。");});return()=>{active=false;};},[username]);
  useEffect(()=>{
    if(day || date!==today || attempted.current===date)return;attempted.current=date;
    update(s=>{const p=s.daily??emptyPlans(s.examMonth);return {...s,daily:{...p,days:{...p.days,[date]:makeDay(date,s,p)}}};});
  },[date,today,day,update]);
  useEffect(()=>{
    if(!day || date!==today)return;
    const next=reconcileDay(day,state,words,writing);
    if(JSON.stringify(next)!==JSON.stringify(day))update(s=>({...s,daily:{...(s.daily??plans),days:{...(s.daily??plans).days,[date]:next}}}));
  },[day,date,today,state,words,writing,plans,update]);
  const edit=(id:string,patch:Partial<DailyTask>)=>update(s=>{const p=s.daily??plans;const current=p.days[date];return {...s,daily:{...p,days:{...p.days,[date]:{...current,tasks:current.tasks.map(t=>t.id===id?{...t,...patch}:t)}}}};});
  const setPhase=(phase:typeof plans.phase)=>update(s=>({...s,daily:{...(s.daily??plans),phase}}));
  const doExport=()=>{
    if(!day)return;if(!writingReady){setNotice("请等待写作记录读取完成；读取失败时请先处理，避免漏导原稿。");return;}
    if(day.packages.length>=3){setNotice("本日已保留 3 份导出快照。可重新下载已有材料；需要新快照时请先备份，再删除不需要的快照。");return;}
    const complete=reconcileDay(day,state,words,writing);
    const source={...complete,tasks:complete.tasks.map(t=>{
      let evidence=t.evidence;
      if(date===today){
        const lesson=LESSONS.find(l=>l.id===t.target),work=state.lessons?.[t.target];
        if(lesson&&work)evidence=`${work.submitted?"已提交原稿":"未提交草稿"}\n${lessonMaterials(lesson,work)}`;
        if(t.kind==="vocab")evidence=words.find(w=>w.date===date)?.text??evidence;
        if(t.kind==="writing"){const items=writing.filter(w=>localDay(new Date(w.createdAt))===date||(w.submittedAt&&localDay(new Date(w.submittedAt))===date));if(items.length)evidence=items.map(w=>`${w.submittedAt?"已提交":"未提交草稿"}\n${reviewMaterials(w)}`).join("\n\n");}
      }
      const ex=EXERCISES.find(e=>e.id===t.target);
      if(ex)evidence=`题目材料：${ex.text}\n问题与答案依据：${JSON.stringify(ex.questions,null,2)}\n孩子的提交记录：${evidence||"无提交"}`;
      return {...t,evidence:limitEvidence(evidence)};
    })};
    const packet=exportDay(username,source);
    if(update(s=>{const p=s.daily??plans;return {...s,daily:{...p,days:{...p.days,[date]:{...complete,packages:[...day.packages,packet]}}}};})){
      download(`PET-daily-${date}-${packet.id.slice(0,8)}.txt`,packet.material);setNotice("已导出学习材料和回传 JSON 模板。照片、录音须另附；没有完成的任务已明确标注。");
    }
  };
  const preview=(text:string)=>{try{if(!day)throw new Error("本日没有任务记录。");setPending(parseDailyFeedback(text,username,day));setNotice("校验通过，请预览点评后确认保存。原始答案不会被覆盖。");}catch(e){setPending(null);setNotice(e instanceof Error?e.message:"无法读取点评");}};
  return <section aria-label="今日备考任务">
    <h2>今日备考任务</h2><p>从这里开始，逐项进入课程，再返回记录结果。时间是计划用时，不是自动计时或真实学习时长。</p>
    <details><summary>阶段与时间设置（家长调整）</summary><div className="pet-writing-grid"><label>查看学习日期<input type="date" max={today} value={date} onChange={e=>{if(e.target.value){setDate(e.target.value);setPending(null);setRaw("");}}}/></label><label>阶段安排<select value={plans.phase} onChange={e=>setPhase(e.target.value as typeof plans.phase)}><option value="auto">按切换日期自动安排</option><option value="foundation">前期：词汇、语法与写作基础</option><option value="sprint">后期：限时与综合训练</option></select></label><label>后期开始日期<input type="date" value={plans.sprintStart} onChange={e=>{if(e.target.value)update(s=>({...s,daily:{...(s.daily??plans),sprintStart:e.target.value}}));}}/></label><button onClick={onSettings}>调整考试日期与每日时长</button></div>
    <p>目标考试：{state.examMonth}；推荐后期从 {defaultSprint(state.examMonth)} 开始，可手动改。设置用于新一天；已有任务保留，避免覆盖已完成内容。未完成任务不会自动堆到次日。</p></details>
    {day ? <>
      <h3>{date} · {day.phase==="foundation"?"前期基础":"后期综合"}</h3>
      {date===today && <button disabled={day.packages.length>0||day.tasks.some(t=>t.done||t.note.trim()||t.evidence)} onClick={()=>update(s=>{const p=s.daily??plans;return {...s,daily:{...p,days:{...p.days,[date]:makeDay(date,s,p)}}};})}>按新设置重新安排今日任务</button>}
      <p>重新安排仅用于还没有作答、备注或导出记录的一天；已有记录时请逐项调整或暂缓。</p>
      <p>{day.tasks.filter(t=>t.done&&!t.skipped).length} / {day.tasks.filter(t=>!t.skipped).length} 项完成 · 计划 {day.tasks.filter(t=>!t.skipped).reduce((n,t)=>n+t.minutes,0)} 分钟{day.tasks.some(t=>t.skipped)?" · 有任务暂缓":""}</p>
      <p>前期每天保留词汇和听力，语法/写作轮换，阅读/口语穿插；周末安排完整写作。后期增加分科主练与错题复盘，综合小题不等于整套模考。</p>
      {day.tasks.map((task,i)=><article key={task.id} className="pet-writing-practice">
        <h3>{i+1}. {TASK_NAMES[task.kind]} · {task.title}</h3><p>{TASK_HELP[task.kind]}</p>
        <p>{task.skipped?"暂缓，保留记录":task.done?`已完成 · ${task.completedBy==="submission"?"检测到提交（不代表已掌握）":"手动确认"}`:"待完成"}</p>
        <div className="pet-writing-actions"><button disabled={date!==today||task.skipped} onClick={()=>onStart(task)}>开始任务 {i+1}</button><label>计划分钟 {i+1}<input type="number" min={0} max={240} value={task.minutes} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=240)edit(task.id,{minutes:n});}}/></label></div>
        {!task.done && <label>替换任务 {i+1}<select value={task.kind} onChange={e=>{if(task.note.trim()){setNotice("此任务已有学习记录，请先导出或保留记录，再清空备注后替换。");return;}const next=taskFor(e.target.value as DailyTask["kind"],task.minutes,state);edit(task.id,{...next,id:task.id});}}>{TASK_KINDS.map(k=><option key={k} value={k}>{TASK_NAMES[k]}</option>)}</select></label>}
        {!task.done && ["reading","listening","grammar","composition"].includes(task.kind) && <label>指定内容 {i+1}<select value={task.target} onChange={e=>{const id=e.target.value;const title=LESSONS.find(l=>l.id===id)?.title??EXERCISES.find(x=>x.id===id)?.title??TASK_NAMES[task.kind];edit(task.id,{target:id,title,baseline:state.lessons?.[id]?JSON.stringify(state.lessons[id]):""});}}><option value="">自主材料／复习（手动记录）</option>{["grammar","composition"].includes(task.kind)?LESSONS.filter(l=>l.kind===(task.kind==="grammar"?"grammar":"writing")).map(l=><option key={l.id} value={l.id}>{l.title}</option>):EXERCISES.filter(e=>e.skill===task.kind).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
        <label>学习记录 {i+1}<textarea maxLength={5000} value={task.note} onChange={e=>edit(task.id,{note:e.target.value})} placeholder="实际用时、材料来源、题目与回答、错误原因、录音/照片文件名。手动确认前请填写。"/></label>
        <label className="pet-writing-check"><input type="checkbox" checked={task.done} disabled={task.skipped||task.completedBy==="submission"} onChange={e=>{if(e.target.checked&&!task.note.trim()){setNotice("手动确认前，请填写本项学习记录，避免把打开页面当作完成。");return;}edit(task.id,{done:e.target.checked,completedBy:e.target.checked?"manual":""});}}/>手动确认完成 {i+1}</label>
        {!task.done&&<label className="pet-writing-check"><input type="checkbox" checked={task.skipped} onChange={e=>edit(task.id,{skipped:e.target.checked})}/>暂缓这项任务 {i+1}</label>}
        {date!==today&&!task.done&&<button onClick={()=>{const current=plans.days[today]??makeDay(today,state,plans);if(current.tasks.length>=8){setNotice("今天最多安排 8 项任务，请先调整当天安排。");return;}const copy={...taskFor(task.kind,task.minutes,state),target:task.target,baseline:state.lessons?.[task.target]?JSON.stringify(state.lessons[task.target]):"",title:`补做 ${date}：${task.title}`};if(update(s=>{const p=s.daily??plans;return {...s,daily:{...p,days:{...p.days,[today]:{...current,tasks:[...current.tasks,copy]}}}};})){setDate(today);setNotice("已由你手动加入今天，请检查总时长并适当暂缓其他任务。");}}}>安排今天补做 {i+1}</button>}
        {task.evidence&&<details><summary>查看实际提交材料 {i+1}</summary><pre className="pet-prep-report">{task.evidence}</pre></details>}
      </article>)}
      <h3>当天材料导出与外部点评</h3><p>可在全部完成后导出，也可导出部分完成的真实记录。文件会包含回传格式，复制给你选择的外部 AI；本应用不自动联网调用 AI。请先检查将要分享的内容。</p>
      <button onClick={doExport}>导出当天学习材料</button>
      {day.packages.map(packet=><article className="pet-writing-practice" key={packet.id}><strong>导出版本 {packet.id.slice(0,8)}</strong><p>{new Date(packet.at).toLocaleString()} · 快照不会因后续作答改变</p><button onClick={()=>download(`PET-daily-${date}-${packet.id.slice(0,8)}.txt`,packet.material)}>重新下载此版本</button><details><summary>查看此版本材料</summary><pre className="pet-prep-report">{packet.material}</pre></details>{packet.feedback&&<><h4>外部 AI／人工点评（待家长核对）</h4><p className="pet-prep-text">{packet.feedback.summary}</p>{packet.feedback.tasks.map(f=><div key={f.taskId}><strong>任务 {packet.taskIds.indexOf(f.taskId)+1}</strong><p className="pet-prep-text">{f.feedback}</p><p className="pet-prep-text">下次建议：{f.nextPractice}</p></div>)}</>}<button onClick={()=>{if(!confirm("仅删除此导出快照及其点评，原始学习记录不变。请确认已下载备份。"))return;update(s=>{const p=s.daily??plans;return {...s,daily:{...p,days:{...p.days,[date]:{...p.days[date],packages:p.days[date].packages.filter(x=>x.id!==packet.id)}}}};});}}>删除此快照及点评</button></article>)}
      <label>粘贴外部点评 JSON<textarea maxLength={200000} value={raw} onChange={e=>{setRaw(e.target.value);setPending(null);}}/></label><button onClick={()=>preview(raw)}>校验并预览点评</button>
      <label>或选择点评 JSON 文件<input type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>200000){setNotice("点评文件过大。");return;}try{const text=await file.text();setRaw(text);preview(text);}catch{setNotice("读取文件失败，请重试。");}}}/></label>
      {pending&&<div className="pet-writing-notice"><h4>导入预览 · {pending.date}</h4><p className="pet-prep-text">{pending.summary}</p>{pending.tasks.map(t=><p className="pet-prep-text" key={t.taskId}>{t.feedback}{"\n下次练习："}{t.nextPractice}</p>)}<button onClick={()=>{if(!day.packages.some(p=>p.id===pending.packageId)){setNotice("对应导出快照已不存在，请重新校验。");setPending(null);return;}if(day.packages.find(p=>p.id===pending.packageId)?.feedback&&!confirm("此版本已有点评，确认用预览中的点评替换吗？"))return;if(update(s=>{const p=s.daily??plans;return {...s,daily:{...p,days:{...p.days,[date]:{...p.days[date],packages:p.days[date].packages.map(packet=>packet.id===pending.packageId?{...packet,feedback:pending}:packet)}}}};})){setPending(null);setNotice("点评已保存。原始作答和完成状态未改变，请家长核对建议后再调整任务。");}}}>确认导入点评</button></div>}
      {date!==today && <button onClick={()=>{if(!confirm("将先下载完整备考备份，再删除这一天的任务、快照和点评。其他模块的原始作答保留。继续吗？"))return;download(`PET-preparation-${username}-before-delete.json`,JSON.stringify({kind:"pet-preparation",version:1,username,data:state}));if(update(s=>{const p=s.daily??plans;const days={...p.days};delete days[date];return {...s,daily:{...p,days}};}))setDate(today);}}>备份后删除本日任务记录</button>}
    </>:<p>这一天没有任务记录。任务不会自动从别的日期复制过来。</p>}
    <p role="alert">{notice}</p><p>日计划和点评随备考 JSON 一起备份。最多保留 90 天、每天 3 个导出快照；接近存储上限请先备份。在“家长复盘”恢复备份会替换当前备考记录。</p>
  </section>;
}
