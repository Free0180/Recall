import { useState } from "react";
import { blankLesson, LESSONS, lessonMaterials, type Lesson, type LessonWork } from "./course-data";

interface Props {
  kind: Lesson["kind"];
  initialLesson?: string;
  work: Record<string, LessonWork>;
  onSave: (id: string, work: LessonWork) => boolean;
  onWriting: () => void;
}

export function CourseView({ kind, work, onSave, onWriting, initialLesson }: Props) {
  const lessons = LESSONS.filter(lesson => lesson.kind === kind);
  const [selected, setSelected] = useState(initialLesson || lessons[0].id);
  const lesson = lessons.find(item => item.id === selected) ?? lessons[0];
  return <section aria-label={kind === "grammar" ? "语法小课" : "写作表达小课"}>
    <h2>{kind === "grammar" ? "语法小课：从理解到运用" : "写作表达：句子、段落到整篇"}</h2>
    <p>每节建议 15—20 分钟。先理解使用场景，再做题、造句、写段落。会做选择题不等于会独立表达。</p>
    <p>{kind === "grammar" ? "前两课针对这次作文中的基础错误。后续课程涵盖 KET 基础的深化与 PET 常用拓展，并非所有结构都是 PET 才开始接触。" : "这些句型帮助表达清楚、具体、自然，不是固定加分模板。写作先完成题目要求，再考虑结构变化。"}</p>
    <label>选择课程<select value={lesson.id} onChange={event => setSelected(event.target.value)}>
      {lessons.map(item => <option key={item.id} value={item.id}>{item.title}{work[item.id]?.reviewed ? " · 已复查" : work[item.id]?.submitted ? " · 待点评/修改" : work[item.id] ? " · 练习中" : ""}</option>)}
    </select></label>
    <LessonPage key={lesson.id} lesson={lesson} work={work[lesson.id] ?? blankLesson()} onSave={value => onSave(lesson.id, value)} onWriting={onWriting} />
  </section>;
}

function LessonPage({ lesson, work, onSave, onWriting }: { lesson: Lesson; work: LessonWork; onSave: (work: LessonWork) => boolean; onWriting: () => void }) {
  const [showModel, setShowModel] = useState(false);
  const save = (patch: Partial<LessonWork>) => onSave({ ...work, ...patch });
  const exportWork = () => {
    const url = URL.createObjectURL(new Blob([lessonMaterials(lesson, work)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `PET-lesson-${lesson.id}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  return <article className="pet-course">
    <h3>{lesson.title}</h3><p><strong>本课目标：</strong>{lesson.goal}</p>
    <h3>一、先理解知识点</h3>
    <ol>{lesson.teaching.map(point => <li key={point}>{point}</li>)}</ol>
    <h3>二、看例句怎样表达</h3>
    {lesson.examples.map(([sentence, explanation]) => <div className="pet-writing-practice" key={sentence}><p lang="en"><strong>{sentence}</strong></p><p>{explanation}</p></div>)}
    <div className="pet-writing-notice"><strong>常见问题与修改</strong><p lang="en">原句：{lesson.mistake[0]}</p><p lang="en">修改：{lesson.mistake[1]}</p><p>{lesson.mistake[2]}</p></div>
    <h3>三、配套练习</h3><p>此处是学后练习，不计入首次水平诊断。提交后显示解析；重练会替换本课的选择答案。</p>
    {lesson.questions.map((question, index) => <fieldset className="pet-writing-practice" key={question.prompt} disabled={work.checked}>
      <legend>{index + 1}. {question.prompt}</legend>
      {question.choices.map(choice => <label key={choice}><input type="radio" name={`${lesson.id}-${index}`} checked={work.answers[String(index)] === choice} onChange={() => save({ answers: { ...work.answers, [index]: choice } })} />{choice}</label>)}
      {work.checked && <div className="pet-prep-explanation"><strong>{work.answers[String(index)] === question.answer ? "正确" : `需复习，答案：${question.answer}`}</strong><p>{question.why}</p></div>}
    </fieldset>)}
    <button disabled={!work.checked && lesson.questions.some((_, i) => !work.answers[String(i)])} onClick={() => save(work.checked ? { checked: false, answers: {} } : { checked: true })}>{work.checked ? "重新做配套练习" : "提交配套练习并看解析"}</button>
    <h3>四、独立造句与段落运用</h3>
    <p>请先自己完成。所有输入按账号保存在本机，并纳入“家长复盘”中的备考备份；不自动判断自由表达对错。</p>
    <label>我的句子练习<textarea maxLength={10000} readOnly={work.submitted} value={work.sentence} onChange={event => save({ sentence: event.target.value })} /></label><p className="pet-writing-prompt">任务：{lesson.sentence}</p>
    <label>本课独立原稿<textarea className="pet-writing-essay" maxLength={10000} readOnly={work.submitted} value={work.original} onChange={event => save({ original: event.target.value })} /></label><p className="pet-writing-prompt">任务：{lesson.paragraph}</p>
    <p>{lesson.checklist.map(item => `□ ${item}`).join("　")}</p>
    {!work.submitted && <button disabled={!work.sentence.trim() || !work.original.trim()} onClick={() => save({ submitted: true })}>提交本课原稿并保留</button>}
    {work.submitted && <p role="status">原稿已保留，后续修改请写在修改稿中。</p>}
    <div className="pet-writing-actions"><button onClick={() => setShowModel(v => !v)}>{showModel ? "收起参考示范" : "查看参考示范（非唯一答案）"}</button><button onClick={exportWork}>导出本课点评材料</button></div>
    {showModel && <div className="pet-writing-practice"><p>先完成自己的版本，再对比表达。参考示范只展示一种可能，不用于字符串判分。</p><p lang="en">{lesson.model}</p></div>}
    <h3>五、手工点评与修改</h3>
    <p>导出题目和原稿发到当前对话；收到点评后粘贴在下方。这里没有 AI 接口，也不会自动给出考试分数。</p>
    <label>本课手工点评<textarea maxLength={10000} value={work.feedback} onChange={event => save({ feedback: event.target.value, reviewed: false })} /></label>
    <label>本课修改稿<textarea maxLength={10000} disabled={!work.submitted} value={work.revision} onChange={event => save({ revision: event.target.value, reviewed: false })} /></label>
    {work.submitted && <div className="pet-writing-grid pet-writing-comparison"><div><h4>保留原稿</h4><p className="pet-prep-text">{work.original}</p></div><div><h4>修改后</h4><p className="pet-prep-text">{work.revision || "等待修改"}</p></div></div>}
    <label className="pet-writing-check"><input type="checkbox" disabled={!work.submitted || !work.feedback.trim() || !work.revision.trim()} checked={work.reviewed} onChange={event => save({ reviewed: event.target.checked })} />已由家长或老师复查本课修改稿</label>
    <div className="pet-writing-actions"><button onClick={onWriting}>进入整篇写作任务</button></div>
    <p>下一次换一个主题，再独立使用本课表达。整篇写作的记录和照片在“写作”模块单独备份。</p>
  </article>;
}
