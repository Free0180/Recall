import { useEffect, useState } from "react";
import { BookOpen, Check, Headphones, LoaderCircle, LockKeyhole, Volume2 } from "lucide-react";
import { type PetWord } from "./pet-words";
import { WordStudyCard } from "./word-study-card";
import { speak, stopSpeech } from "./pet-speech";
import { generateOfflineArticle, OFFLINE_ARTICLE_VERSION } from "./offline-article";
import { ArticlePlayback } from "./article-playback";
import { addDays, currentStudyDay, dictationCount, normaliseSpelling, studiedCount, updateStudyDay, wordsComplete, type Rating, type StudyDay, type StudySchedule } from "./study-cycle";
import type { DailyArticle } from "./study-article";
import "./weekly-study.css";

interface WeeklyStudyProps {
  wordPool: PetWord[];
  username: string;
  today: string;
  schedule: StudySchedule;
  onUpdate: (update: (schedule: StudySchedule) => StudySchedule) => void;
  onRate: (word: PetWord, rating: Rating, scheduled: boolean) => void;
  practiceWord: PetWord | null;
  onPracticeWord: (word: PetWord | null) => void;
}

export function WeeklyStudy({ wordPool, username, today, schedule, onUpdate, onRate, practiceWord, onPracticeWord }: WeeklyStudyProps): JSX.Element {
  const { cycle, day, dayIndex } = currentStudyDay(schedule, today);
  const [cursor, setCursor] = useState(() => Math.max(0, day.wordIds.findIndex((id) => !day.ratings[id])));
  const [articleError, setArticleError] = useState("");
  const [retry, setRetry] = useState(0);
  const complete = wordsComplete(day);
  const reviewDay = dayIndex >= 5;
  const idsKey = day.wordIds.join(",");
  const cycleNumber = cycle.number;
  const hasArticle = Boolean(day.article && (day.article.source !== "offline" || day.article.offlineVersion === OFFLINE_ARTICLE_VERSION));
  const words = day.wordIds.map((id) => wordPool.find((word) => word.id === id)!);
  const word = practiceWord ?? words[cursor % Math.max(1, words.length)];

  useEffect(() => {
    if (!complete || hasArticle) return;
    setArticleError("");
    try {
      const article = generateOfflineArticle(idsKey.split(",").map(Number), today, wordPool);
      onUpdate((previous) => updateStudyDay(previous, cycleNumber, dayIndex, (item) => wordsComplete(item) && item.wordIds.join(",") === idsKey ? { ...item, article } : item));
    } catch (error: unknown) {
      setArticleError(error instanceof Error ? error.message : "文章生成失败，请重试");
    }
  }, [complete, hasArticle, username, today, idsKey, cycleNumber, dayIndex, retry, onUpdate, wordPool]);

  const history = schedule.cycles.flatMap((item) => item.days.flatMap((entry, index) => entry.article && (item.number !== cycleNumber || index !== dayIndex)
    ? [{ date: addDays(item.startDate, index), article: entry.article }] : [])).reverse();

  function move(index: number): void {
    if (practiceWord) onPracticeWord(wordPool[(index + wordPool.length) % wordPool.length]);
    else setCursor((index + words.length) % words.length);
  }

  function rate(rating: Rating): void {
    if (!word) return;
    onRate(word, rating, !practiceWord);
    if (practiceWord) move(wordPool.findIndex((item) => item.id === word.id) + 1);
    else {
      const remainingIndex = day.wordIds.findIndex((id) => id !== word.id && !day.ratings[id]);
      setCursor(remainingIndex < 0 ? 0 : remainingIndex);
    }
  }

  return <div className="pet-weekly-study">
    <section className="pet-cycle-banner" aria-label="七天学习周期">
      <div><span>第 {cycleNumber} 周期 · {today}</span><h2>第 {dayIndex + 1} 天 · {reviewDay ? "巩固复习" : "学习新词"}</h2><p>前 5 天学新词 · 后 2 天复习本期与往期薄弱词</p></div>
      <ol className="pet-cycle-days">
        {cycle.days.map((entry, index) => <li key={index} aria-current={index === dayIndex ? "step" : undefined} className={`${index === dayIndex ? "is-current" : ""} ${wordsComplete(entry) ? "is-complete" : ""}`}>
          <span>第 {index + 1} 天</span><strong>{index < 5 ? "新词" : "复习"}</strong><small>{index >= 5 && !cycle.reviewPlanned ? "待定" : `${entry.wordIds.length} 词`}</small>
        </li>)}
      </ol>
    </section>
    <div className="pet-study-grid">
      <div className="pet-daily-main">
        {practiceWord ? <div className="pet-free-practice"><span>自由练习 · 不计入当天任务</span><button type="button" onClick={() => onPracticeWord(null)}>返回今日计划</button></div> : null}
        {word && (practiceWord || !complete) ? <WordStudyCard word={word} index={practiceWord ? wordPool.findIndex((item) => item.id === word.id) : cursor % words.length} total={practiceWord ? wordPool.length : words.length} onMove={move} onRate={rate} />
          : <section className="pet-daily-complete"><Check aria-hidden="true" /><h1>{complete ? "今日单词已完成" : reviewDay ? "今天没有待复习词" : "今天没有新词任务"}</h1>
            <p>{complete ? "接下来进行听写，在文章里巩固今天的单词。" : reviewDay ? "复习合并本周期和往期已学过、仍不认识或有点熟的词；认识后退出后续复习计划。" : "请先到词库把需要学习的词标为“不认识”，再点击“增加”更新学习计划。今天已完成后加入的词安排在后续学习日。"}</p>
          </section>}
        <section className="pet-daily-module" aria-labelledby="daily-dictation-title">
          <div className="pet-daily-module-heading"><Headphones aria-hidden="true" /><h2 id="daily-dictation-title">每日听写</h2><span>{dictationCount(day)} / {words.length}</span></div>
          {complete ? <DailyDictation key={`${cycleNumber}:${dayIndex}`} day={day} words={words} onAnswer={(id, answer) => {
            onUpdate((previous) => updateStudyDay(previous, cycleNumber, dayIndex, (entry) => {
              if (!wordsComplete(entry) || !entry.wordIds.includes(id)) return entry;
              const target = wordPool.find((item) => item.id === id)!;
              return { ...entry, dictation: { ...entry.dictation, [id]: { answer, correct: normaliseSpelling(answer) === normaliseSpelling(target.word), attempts: (entry.dictation[id]?.attempts ?? 0) + 1 } } };
            }));
          }} /> : <p className="pet-module-locked"><LockKeyhole aria-hidden="true" />{words.length ? "完成当天全部单词后解锁听写。" : "今天没有听写任务。"}</p>}
        </section>
        <section className="pet-daily-module" aria-labelledby="daily-article-title">
          <div className="pet-daily-module-heading"><BookOpen aria-hidden="true" /><h2 id="daily-article-title">今日 PET 文章</h2><span>离线原创</span></div>
          {!complete ? <p className="pet-module-locked"><LockKeyhole aria-hidden="true" />{words.length ? "学完当天全部单词后，自动生成便于背诵的短文。" : "今天没有词表，无需生成文章。"}</p>
            : day.article ? <ArticleContent article={day.article} />
              : articleError ? <div className="pet-article-error"><p role="alert">{articleError}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重试生成文章</button></div>
                : <p className="pet-article-loading" role="status"><LoaderCircle aria-hidden="true" />正在用今天的 {words.length} 个单词写文章，可先完成听写…</p>}
        </section>
        {history.length ? <section className="pet-daily-module"><h2>往期文章</h2>{history.map((item) => <details className="pet-article-history" key={item.date}><summary>{item.date} · {item.article.title}</summary><ArticleContent article={item.article} /></details>)}</section> : null}
      </div>
      <aside className="pet-study-aside pet-daily-aside">
        <section className="pet-plan"><h2>今日计划</h2>
          <DailyPlanRow label={reviewDay ? "复习单词" : "新学单词"} done={studiedCount(day)} total={words.length} />
          <DailyPlanRow label="单词听写" done={dictationCount(day)} total={words.length} />
          <DailyPlanRow label="PET 文章" done={day.article ? 1 : 0} total={words.length ? 1 : 0} />
          <p>{reviewDay ? `两天分批复习：第 6 天 ${cycle.days[5].wordIds.length} 词，第 7 天 ${cycle.days[6].wordIds.length} 词。` : `每天计划 ${cycle.dailyTarget} 个新词，不足时按实际剩余数量安排。`}</p>
          <p>按本机日期切换。薄弱词自动结转到后续周期的第 6、7 天，无需再点“增加”。未学完的日期不会生成文章。</p>
        </section>
        <section className="pet-plan"><h2>周期设置</h2><label className="pet-target-setting">下周期每日新词数<select value={schedule.dailyTarget} onChange={(event) => {
          const dailyTarget = Number(event.target.value);
          onUpdate((previous) => ({ ...previous, dailyTarget }));
        }}>{[1, 2, 3, 4, 5, 6, 10, 15, 20, 30].map((target) => <option key={target} value={target}>{target} 个</option>)}</select></label><p>当前周期词表已确定，新设置从下周期生效。</p></section>
      </aside>
    </div>
  </div>;
}

function DailyPlanRow({ label, done, total }: { label: string; done: number; total: number }): JSX.Element {
  return <div className="pet-plan-row pet-plan-row--blue"><div><span>{label}</span><strong>{done} / {total}</strong></div><div className="pet-plan-row__bar"><span style={{ width: `${total ? done / total * 100 : 0}%` }} /></div></div>;
}

function DailyDictation({ day, words, onAnswer }: { day: StudyDay; words: PetWord[]; onAnswer: (id: number, answer: string) => void }): JSX.Element {
  const [index, setIndex] = useState(() => Math.max(0, words.findIndex((word) => !day.dictation[word.id]?.correct)));
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const word = words[index];
  const finished = dictationCount(day) === words.length;
  useEffect(() => () => { stopSpeech(); }, []);
  if (finished) return <div className="pet-dictation-finished"><Check aria-hidden="true" /><strong>今日听写已完成</strong><p>{words.length} 个单词都已拼写正确，明天继续！</p></div>;
  return <form className="pet-word-dictation" onSubmit={(event) => {
    event.preventDefault();
    if (!answer.trim() || feedback === "correct") return;
    onAnswer(word.id, answer);
    setFeedback(normaliseSpelling(answer) === normaliseSpelling(word.word) ? "correct" : "incorrect");
  }}>
    <p>第 {index + 1} / {words.length} 词 · 听发音，写出英文单词</p>
    <button type="button" className="pet-dictation-play" onClick={() => speak(word.word)} aria-label="播放听写单词"><Volume2 aria-hidden="true" />播放单词</button>
    <label>英文拼写<input autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} placeholder="听完后输入，不区分大小写" /></label>
    <div className="pet-dictation-buttons"><button type="submit" disabled={!answer.trim() || feedback === "correct"}>检查拼写</button>
      {feedback === "correct" ? <button type="button" onClick={() => { setIndex(words.findIndex((item) => !day.dictation[item.id]?.correct)); setAnswer(""); setFeedback(null); }}>下一词</button> : null}</div>
    {feedback ? <div role="status" className={feedback === "correct" ? "pet-answer-correct" : "pet-answer-incorrect"}>{feedback === "correct" ? "拼写正确！" : "拼写还不正确，再听一次。"}</div> : null}
    {feedback === "incorrect" ? <details><summary>查看答案与词义</summary><p><strong>{word.word}</strong> · {word.meaning}</p></details> : null}
  </form>;
}

function ArticleContent({ article }: { article: DailyArticle }): JSX.Element {
  const focus = new Set(article.focusWords.map((word) => word.toLowerCase()));
  return <article className="pet-generated-article">
    <h3>{article.title}</h3><p className="pet-article-meta">PET / B1 练习 · {article.paragraphs.join(" ").match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length ?? 0} 词 · 覆盖 {article.focusWords.length} 个目标词 · {article.source === "offline" ? "离线原创组文" : "已保存文章"}</p>
    {article.offlineVersion === OFFLINE_ARTICLE_VERSION ? <div className="pet-writing-guide"><p><strong>三步背诵：</strong>活动背景 → 具体经历 → 感受与建议</p><p>写作要点：回应题目所有要求；分段清楚；用连接词、理由和准确时态。本文练习 article 写法，实际答题按题目调整内容。</p>{article.focusWords.length > 10 ? <p>今天目标词较多，短文相应加长，可分三段背诵。</p> : null}</div> : null}
    <ArticlePlayback text={article.paragraphs.join(" ")} />
    <div lang="en-GB">{article.paragraphs.map((paragraph, index) => <p key={index}>{paragraph.split(/(\b[A-Za-z]+\b)/).map((token, tokenIndex) => focus.has(token.toLowerCase()) ? <mark key={tokenIndex}>{token}</mark> : token)}</p>)}</div>
    <details><summary>目标词与语法讲解</summary><p>{article.focusWords.join(" · ")}</p>{article.grammar.map((point, index) => <div className="pet-grammar-point" key={index}><h4>{point.label}</h4><blockquote lang="en-GB">{point.example}</blockquote><p>{point.explanation}</p></div>)}</details>
  </article>;
}
