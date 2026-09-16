import { useEffect, useRef, useState } from "react";
import { createAttempt, importFeedback, readWritingBackup, reviewMaterials, taskFor, wordCount, writingBackup, WRITING_TASKS, type WritingAttempt, type WritingPhoto } from "./writing-data";
import { loadWriting, saveWriting } from "./writing-storage";
import "./writing.css";

function download(name: string, content: string, type = "text/plain;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function photoFromFile(file: File): Promise<WritingPhoto> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) throw new Error("请选择 12 MB 以内的 JPG、PNG 或 WebP 图片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法处理照片。");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    if (data.length > 2_800_000) throw new Error("照片压缩后仍过大，请裁切纸张周围的空白后重试。");
    return { name: file.name.slice(0, 195).replace(/\.[^.]+$/, "") + ".jpg", data };
  } finally { URL.revokeObjectURL(url); }
}

export function WritingView({ username, onOpenLessons }: { username: string; onOpenLessons?: () => void }): JSX.Element {
  const [attempts, setAttempts] = useState<WritingAttempt[]>([]);
  const current = useRef<WritingAttempt[]>([]);
  const [selected, setSelected] = useState("");
  const [taskId, setTaskId] = useState<string>(WRITING_TASKS[0].id);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("正在读取写作记录...");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const attempt = attempts.find(a => a.id === selected);
  useEffect(() => {
    alive.current = true;
    let active = true;
    void loadWriting(username).then(data => {
      if (!active) return;
      current.current = data; setAttempts(data); setSelected(data[0]?.id ?? ""); setReady(true); setSaved("已读取本机记录");
    }).catch(() => { if (active) setSaved("无法读取本机写作存储。请检查浏览器存储权限，保留备份后重试。"); });
    return () => { active = false; alive.current = false; };
  }, [username]);
  function commit(next: WritingAttempt[]): void {
    current.current = next; setAttempts(next); setSaved("正在保存到本机...");
    const version = ++sequence.current;
    void saveWriting(username, next).then(() => {
      if (alive.current && version === sequence.current) setSaved("已保存到本机");
    }).catch((error: unknown) => { if (alive.current && version === sequence.current) setSaved(`保存失败，${error instanceof Error ? error.message : "请检查设备存储空间。"}请先导出写作备份，避免关闭页面后丢失。`); });
  }
  function update(id: string, patch: Partial<WritingAttempt>): void {
    commit(current.current.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  function start(): void {
    if (current.current.length >= 12) { setNotice("本机最多保存 12 次练习，请先导出备份，再移除旧记录。"); return; }
    const next = createAttempt(taskId);
    commit([next, ...current.current]); setSelected(next.id); setNotice("");
  }
  async function attach(files: FileList | null): Promise<void> {
    if (!attempt || !files?.length || attempt.submittedAt) return;
    if (attempt.photos.length + files.length > 2) { setNotice("每篇原稿最多保存两张照片。"); return; }
    const id = attempt.id;
    setBusy(true); setNotice("");
    try {
      const photos = await Promise.all(Array.from(files, photoFromFile));
      if (!alive.current) return;
      const latest = current.current.find(a => a.id === id);
      if (latest && !latest.submittedAt) update(id, { photos: [...latest.photos, ...photos] });
    } catch (error) { if (alive.current) setNotice(error instanceof Error ? error.message : "照片无法读取。"); }
    finally { if (alive.current) setBusy(false); }
  }
  async function readFile(file: File | undefined, kind: "feedback" | "backup"): Promise<void> {
    if (!file) return;
    const id = attempt?.id;
    try {
      if (file.size > (kind === "feedback" ? 100_000 : 70_000_000)) throw new Error("文件过大，请检查是否选对文件。");
      const raw = await file.text();
      if (!alive.current) return;
      if (kind === "feedback") {
        const latest = current.current.find(a => a.id === id);
        if (!latest?.submittedAt) throw new Error("请先提交当前原稿。");
        const feedback = importFeedback(raw, latest);
        if ((latest.feedback || latest.revisionFeedback) && !window.confirm("导入会替换当前两栏点评，请先确认已保留需要的内容。继续导入？")) return;
        update(latest.id, feedback); setNotice("点评已导入，请按修改任务完成修改稿。");
      } else {
        const imported = readWritingBackup(raw, username);
        const additions = imported.flatMap(item => {
          const existing = current.current.find(a => a.id === item.id);
          if (existing && JSON.stringify(existing) === JSON.stringify(item)) return [];
          return [{ ...item, id: existing ? crypto.randomUUID() : item.id }];
        });
        if (current.current.length + additions.length > 12) throw new Error("恢复后超过 12 条记录，请先备份并移除不需要的旧记录。未导入任何数据。");
        commit([...additions, ...current.current]);
        if (additions[0]) setSelected(additions[0].id);
        setNotice("已合并恢复写作备份。同编号的不同内容另存为副本，未覆盖现有记录。");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法导入此文件。"); }
  }
  function submit(): void {
    if (!attempt) return;
    if (!attempt.original.trim() && !attempt.photos.length) { setNotice("请先输入作文或添加手写照片。"); return; }
    update(attempt.id, { submittedAt: new Date().toISOString() });
    setNotice("原稿已保留。请导出材料和照片发到聊天中，收到点评后粘贴到下方。");
  }
  function remove(): void {
    if (!attempt || !window.confirm("将先下载当前全部写作记录的备份，再从本机移除这条记录。确认继续？")) return;
    download(`PET-writing-${username}-backup.json`, writingBackup(username, current.current), "application/json");
    const next = current.current.filter(a => a.id !== attempt.id); commit(next); setSelected(next[0]?.id ?? "");
  }
  return <section className="pet-page pet-writing">
    <div className="pet-page-heading"><span>练习 · 手工点评 · 修改</span><h1>写作练习</h1><p>先独立完成，再带着反馈修改。所有题目为原创练习，不是官方试题。</p></div>
    {onOpenLessons && <div className="pet-writing-notice"><p>还不知道怎样写？先学习句型、例句和段落组织，再完成整篇任务。</p><button onClick={onOpenLessons}>先学写作表达课</button></div>}
    <section className="pet-profile-section">
      <h2>我的写作本</h2><p>作文、照片和点评按账号保存在当前设备，暂不云同步。发到聊天后才能获得点评；本页不会自动评分。</p>
      <p role="status">{saved}</p>
      <div className="pet-writing-actions">
        <button type="button" disabled={!ready} onClick={() => download(`PET-writing-${username}-backup.json`, writingBackup(username, current.current), "application/json")}>导出写作备份（含照片）</button>
        <label className="pet-writing-file">恢复写作备份<input type="file" accept=".json,application/json" disabled={!ready} onChange={event => { void readFile(event.target.files?.[0], "backup"); event.target.value = ""; }} /></label>
        {saved.startsWith("保存失败") ? <button type="button" onClick={() => commit(current.current)}>重试保存</button> : null}
      </div>
      <div className="pet-writing-grid">
        <label>选择写作题目<select value={taskId} onChange={event => setTaskId(event.target.value)}>{WRITING_TASKS.map(task => <option key={task.id} value={task.id}>{task.genre} · {task.title}</option>)}</select></label>
        <button type="button" disabled={!ready || busy} onClick={start}>开始一篇新练习</button>
      </div>
      {attempts.length ? <label>已有写作记录<select value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setNotice(""); }}>{attempts.map((a, i) => <option key={a.id} value={a.id}>{i + 1}. {taskFor(a).title} · {new Date(a.createdAt).toLocaleDateString()} · {a.revision ? "已有修改稿" : a.feedback ? "待修改" : a.submittedAt ? "待点评" : "草稿"}</option>)}</select></label> : <p>先选择“朋友来访”，也可以把已经写好的纸上作文保存进来。</p>}
    </section>
    {notice ? <p className="pet-writing-notice" role="alert">{notice}</p> : null}
    {attempt ? <>
      <section className="pet-profile-section">
        <h2>{taskFor(attempt).genre} · {taskFor(attempt).title}</h2>
        <p className="pet-writing-prompt" lang="en">{taskFor(attempt).prompt}</p>
        <p>建议约 100 词，练习用时 25 分钟：审题 3 分钟、写作 17 分钟、检查 5 分钟。时间只是练习建议。</p>
        <label>我的审题记录<textarea aria-label="我的审题记录" maxLength={2000} readOnly={!!attempt.submittedAt} value={attempt.plan} onChange={event => update(attempt.id, { plan: event.target.value })} placeholder="先自己列出题目要求，不用写完整句子。" /></label>
        <label>作文原稿<textarea aria-label="作文原稿" className="pet-writing-essay" lang="en" spellCheck={false} autoCorrect="off" autoCapitalize="off" maxLength={12000} readOnly={!!attempt.submittedAt} value={attempt.original} onChange={event => update(attempt.id, { original: event.target.value })} placeholder="在这里独立写作，或者在下方添加手写照片。" /></label>
        <p>输入文字：{wordCount(attempt.original)} 词{attempt.photos.length ? "；照片不自动识别或计字。" : "。"}{attempt.submittedAt ? "原稿已锁定，请在修改稿中订正。" : "输入后自动保存草稿。"}</p>
        <div className="pet-writing-photos">{attempt.photos.map((photo, i) => <figure key={`${photo.name}-${i}`}><img src={photo.data} alt={`手写原稿第 ${i + 1} 页`} /><figcaption><a href={photo.data} download={`PET-${attempt.id}-page-${i + 1}.jpg`}>下载照片 {i + 1}</a>{!attempt.submittedAt ? <button type="button" disabled={busy} onClick={() => update(attempt.id, { photos: attempt.photos.filter((_, index) => index !== i) })}>移除照片 {i + 1}</button> : null}</figcaption></figure>)}</div>
        {!attempt.submittedAt ? <label className="pet-writing-file">{busy ? "正在处理照片..." : "添加手写照片（最多两张）"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => { void attach(event.target.files); event.target.value = ""; }} /></label> : null}
        <p>照片仅在浏览器内压缩保存。请保留手机上的原始照片。</p>
        <div className="pet-writing-grid"><label>实际用时（分钟）<input type="number" min="0" max="9999" readOnly={!!attempt.submittedAt} value={attempt.minutes} onChange={event => { if (/^\d{0,4}$/.test(event.target.value)) update(attempt.id, { minutes: event.target.value }); }} /></label><label className="pet-writing-check"><input type="checkbox" disabled={!!attempt.submittedAt} checked={attempt.independent} onChange={event => update(attempt.id, { independent: event.target.checked })} />独立完成，未查词或接受提示</label></div>
        <label>帮助或补充说明<textarea maxLength={2000} readOnly={!!attempt.submittedAt} value={attempt.help} onChange={event => update(attempt.id, { help: event.target.value })} placeholder="例如：20 分钟独立完成，家长未修改。" /></label>
        {!attempt.submittedAt ? <button type="button" className="pet-writing-primary" disabled={busy} onClick={submit}>提交并保留原稿</button> : null}
      </section>
      {attempt.submittedAt ? <>
        <section className="pet-profile-section">
          <h2>把材料交给点评者</h2><p>下载材料，将文件和上面的作文照片一起发到聊天。原稿与修改稿都包含在材料中，照片需要另外附上。</p>
          <button type="button" onClick={() => download(`PET-writing-${attempt.id}.txt`, reviewMaterials(attempt))}>导出点评材料</button>
          <details><summary>查看可复制的点评材料</summary><textarea aria-label="可复制的点评材料" readOnly value={reviewMaterials(attempt)} /></details>
          <ul>{taskFor(attempt).points.map(point => <li key={point}>{point}</li>)}</ul>
          <p>上面是本题要点，提交后可用来核对是否遗漏。</p>
        </section>
        <section className="pet-profile-section">
          <h2>收到点评，再修改</h2><p>可以直接粘贴聊天中的点评。若收到对应的点评 JSON 文件，也可以导入；导入前请保留旧点评。</p>
          <label>原稿点评<textarea aria-label="原稿点评" maxLength={12000} value={attempt.feedback} onChange={event => update(attempt.id, { feedback: event.target.value })} placeholder="粘贴优点、遗漏要点、重点错误和修改任务。" /></label>
          <label className="pet-writing-file">导入点评 JSON<input type="file" accept=".json,application/json" onChange={event => { void readFile(event.target.files?.[0], "feedback"); event.target.value = ""; }} /></label>
          <div className="pet-writing-grid pet-writing-comparison"><div><h3>保留的原稿</h3><p className="pet-writing-original" lang="en">{attempt.original || "原稿为照片，请查看上面的原稿图片。"}</p></div><label>我的修改稿<textarea aria-label="我的修改稿" className="pet-writing-essay" lang="en" spellCheck={false} autoCorrect="off" maxLength={12000} value={attempt.revision} onChange={event => update(attempt.id, { revision: event.target.value })} placeholder="根据反馈独立修改，不必直接照抄范文。纸上修改后可在这里输入修改稿。" /><span>{wordCount(attempt.revision)} 词 · 自动保存</span></label></div>
          <label>修改稿复查点评<textarea aria-label="修改稿复查点评" maxLength={12000} value={attempt.revisionFeedback} onChange={event => update(attempt.id, { revisionFeedback: event.target.value })} placeholder="修改后再次导出点评材料，收到复查反馈后粘贴到这里。" /></label>
        </section>
      </> : null}
      <div className="pet-writing-actions"><button type="button" disabled={busy} onClick={remove}>备份并移除这条记录</button></div>
    </> : null}
    <WritingPractice />
  </section>;
}

const PRACTICE = [
  { question: "The library ___ open on Saturdays.", options: ["is", "are", "be"], answer: "is", reason: "The library 是单数，表示开着的用 is open。" },
  { question: "It ___ not far from my house.", options: ["does", "is", "are"], answer: "is", reason: "far 表示远，句子需要 is：It is not far。" },
  { question: "Please bring ___ water bottle.", options: ["you", "your", "yours"], answer: "your", reason: "名词 water bottle 前面用 your，表示你的水瓶。" },
  { question: "I think ___ films is fun.", options: ["watch", "watching", "watched"], answer: "watching", reason: "Watching films 表示看电影这件事，在句子里作主语。" },
  { question: "We can watch a film ___.", options: ["at there", "to there", "there"], answer: "there", reason: "there 是地点副词，前面不需要 at 或 to。" },
  { question: "Which sentence gives BOTH a meeting time and a place?", options: ["Let's meet at ten.", "Let's meet at my house at ten.", "Let's meet at my house."], answer: "Let's meet at my house at ten.", reason: "at ten 回答几点，at my house 回答在哪里，两项都需要写清楚。" },
];
function WritingPractice(): JSX.Element {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  return <section className="pet-profile-section"><h2>基础表达小练习</h2><p>练习完整句子、代词和时间地点。结果仅供本次练习，不作为考试评分。</p>
    {PRACTICE.map((item, i) => <fieldset className="pet-writing-practice" key={item.question}><legend lang="en">{i + 1}. {item.question}</legend>{item.options.map(option => <label key={option}><input type="radio" name={`writing-practice-${i}`} checked={answers[i] === option} onChange={() => { setAnswers({ ...answers, [i]: option }); setChecked(false); }} />{option}</label>)}{checked ? <p>{answers[i] === item.answer ? "答对了。" : answers[i] ? "再想一想。" : "这题还没作答。"}{item.reason}</p> : null}</fieldset>)}
    <button type="button" onClick={() => setChecked(true)}>核对小练习</button>
  </section>;
}
