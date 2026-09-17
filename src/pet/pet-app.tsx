import { asStudyWord, readSavedWords, studyPool } from "./vocabulary";
import { AddVocabularyButton } from "./add-vocabulary-button";
import {
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  CircleUserRound,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileAudio,
  FileText,
  Gauge,
  Headphones,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Play,
  PencilLine,
  Repeat2,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PET_CATEGORIES, PET_READING, PET_STUDY_WORDS, PET_WORDS, type PetWord } from "@/pet/pet-words";
import {
  authenticatePetUser,
  clearPetSession,
  isPetAuthConfigured,
  loadPetSession,
  PET_USERS,
  subscribePetSession,
  updatePetPassword,
  type PetUser,
} from "@/pet/pet-auth";
import { loadB1Words, type B1Word } from "@/pet/pet-lexicons";
import { loadReadingDocuments, parseReadingFile, removeReadingDocument, saveReadingDocument, splitIntoSentences, type ReadingDocument, type ReadingMode } from "@/pet/reading-documents";
import "@/pet/pet-app.css";
import { SpeechFeedback } from "./speech-feedback";
import { setSpeechPreferences, speak, stopSpeech } from "./pet-speech";
import { SpeechSettingsPanel } from "./speech-settings";
import { DEFAULT_SPEECH, readSpeechSettings, type SpeechSettings } from "./speech-preferences";
import { CloudSync, type SyncStatus } from "./cloud-sync";
import { createCloudTransport } from "./cloud-transport";
import { CloudSyncPanel } from "./cloud-sync-panel";
import { WritingView } from "./writing-view";
import { WeeklyStudy } from "./weekly-study";
import { LISTENING_RESOURCES, listeningPdfUrl, loadListeningResourceId, resourceForFile, type ListeningResource } from "./listening-resources";
import { currentStudyDay, ensureSchedule, localDateKey, readSchedule, studiedCount, updateStudyDay, type Rating, type StudySchedule, type VocabularyChoices, type VocabularyStatus } from "./study-cycle";

const PreparationView = lazy(() => import("./preparation-view").then(module => ({ default: module.PreparationView })));
type Tab = "study" | "library" | "reading" | "writing" | "preparation" | "wrong" | "profile";

interface ReviewRecord {
  wordId: number;
  rating: Rating;
  date: string;
  at: number;
}

interface PetProgress {
  speech: SpeechSettings;
  vocabulary: VocabularyChoices;
  appliedVocabulary: VocabularyChoices;
  savedWords: PetWord[];
  activeIndex: number;
  ratings: Record<number, Rating>;
  reviews: ReviewRecord[];
  streak: number;
  lastStudyDate: string | null;
  schedule: StudySchedule | null;
}

interface ListeningRange {
  start: number;
  end: number;
}

const B1_WORD_COUNT = 2354;
const READING_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const PET_WORD_MAP = new Map(PET_WORDS.map((word) => [word.word.toLowerCase(), word]));
const CAMBRIDGE_LISTENING_PAGE = "https://www.cambridgeenglish.org/exams-and-tests/qualifications/preliminary/preparation/?skill=grammar,listening";

const EMPTY_PROGRESS: PetProgress = {
  speech: DEFAULT_SPEECH,
  vocabulary: {},
  appliedVocabulary: {},
  savedWords: [],
  activeIndex: 0,
  ratings: {},
  reviews: [],
  streak: 0,
  lastStudyDate: null,
  schedule: null,
};

const TABS: Array<{ id: Tab; label: string; icon: typeof Play }> = [
  { id: "study", label: "学习", icon: Play },
  { id: "library", label: "词库", icon: LibraryBig },
  { id: "reading", label: "精读", icon: BookOpen },
  { id: "writing", label: "写作", icon: PencilLine },
  { id: "preparation", label: "备考", icon: Gauge },
  { id: "wrong", label: "错词", icon: BookMarked },
  { id: "profile", label: "我的", icon: CircleUserRound },
];

function previousDateKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function progressStorageKey(username: string): string {
  return `pet-vocab-progress-v2-${username}`;
}

function loadProgress(username: string): PetProgress {
  try {
    const raw = localStorage.getItem(progressStorageKey(username));
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PetProgress>;
    return {
      speech: readSpeechSettings(parsed.speech),
      savedWords: readSavedWords(parsed.savedWords),
      appliedVocabulary: parsed.appliedVocabulary ?? parsed.vocabulary ?? Object.fromEntries(Object.entries(parsed.ratings ?? {}).map(([id, rating]) => [id, rating === "known" ? "known" : "unknown"])),
      vocabulary: parsed.vocabulary ?? Object.fromEntries(Object.entries(parsed.ratings ?? {}).map(([id, rating]) => [id, rating === "known" ? "known" : "unknown"])),
      activeIndex: Math.max(0, Math.min(PET_STUDY_WORDS.length - 1, parsed.activeIndex ?? 0)),
      ratings: parsed.ratings ?? {},
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      streak: Math.max(0, parsed.streak ?? 0),
      lastStudyDate: parsed.lastStudyDate ?? null,
      schedule: readSchedule(parsed.schedule, studyPool(readSavedWords(parsed.savedWords))),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function listeningRangesStorageKey(username: string, documentId: string): string {
  return `pet-listening-ranges-v1-${username}-${documentId}`;
}

function loadListeningRanges(username: string, documentId: string): Record<number, ListeningRange> {
  try {
    const parsed = JSON.parse(localStorage.getItem(listeningRangesStorageKey(username, documentId)) ?? "{}") as Record<number, ListeningRange>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatAudioTime(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function isValidListeningRange(range: ListeningRange | undefined): boolean {
  return Boolean(range && range.end > range.start);
}

function normalizeDictation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function createDictationPrompt(sentence: string): string {
  let wordIndex = 0;
  return sentence.replace(/[A-Za-z]+/g, (word) => {
    wordIndex += 1;
    return word.length > 2 && wordIndex % 2 === 0 ? "_".repeat(Math.min(word.length, 9)) : word;
  });
}

export function PetApp(): JSX.Element {
  const [currentUser, setCurrentUser] = useState<PetUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>("preparation");
  const [dailyReturn, setDailyReturn] = useState(false);
  const [prepPanel, setPrepPanel] = useState<"today" | "plan" | "composition">("today");
  const [progress, setProgress] = useState<PetProgress>(EMPTY_PROGRESS);
  const [notice, setNotice] = useState<string | null>(null);
  const [progressOwner, setProgressOwner] = useState<string | null>(null);
  const progressOwnerRef = useRef<string | null>(null);
  const [today, setToday] = useState(localDateKey);
  const [practiceWord, setPracticeWord] = useState<PetWord | null>(null);
  const syncRef = useRef<CloudSync | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const currentUsername = currentUser?.username ?? null;
  const wordPool = useMemo(() => studyPool(progress.savedWords), [progress.savedWords]);
  const schedule = useMemo(() => ensureSchedule(progress.schedule, progress.ratings, today, progress.appliedVocabulary, wordPool), [progress.schedule, progress.ratings, progress.appliedVocabulary, today, wordPool]);
  const activeDay = currentStudyDay(schedule, today).day;
  const studiedToday = studiedCount(activeDay);

  useEffect(() => {
    const refreshDate = (): void => setToday(localDateKey());
    const timer = window.setInterval(refreshDate, 30_000);
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const applySession = (user: PetUser | null): void => {
      if (!active) return;
      setCurrentUser(user);
      setAuthReady(true);
    };

    void loadPetSession().then(applySession).catch(() => applySession(null));
    const unsubscribe = subscribePetSession(applySession);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setProgress(currentUsername ? loadProgress(currentUsername) : EMPTY_PROGRESS);
    setProgressOwner(currentUsername);
    progressOwnerRef.current = currentUsername;
    setPracticeWord(null);
    setTab("preparation");
    setPrepPanel("today");
    setDailyReturn(false);
    stopSpeech();
    setSyncStatus("local");
    if (!currentUsername) return;
    const transport = createCloudTransport(currentUsername);
    if (!transport) return;
    let sync: CloudSync;
    try {
      sync = new CloudSync(`pet-cloud-v1-${currentUsername}`, JSON.stringify(loadProgress(currentUsername)),
        payload => {
          const item = JSON.parse(payload) as PetProgress;
          return !Object.keys(item.ratings).length && !item.reviews.length && !Object.keys(item.vocabulary).length && !item.savedWords.length
            && (!item.schedule || (item.schedule.dailyTarget === 10 && item.schedule.cycles.every(cycle => cycle.days.every(day => !day.wordIds.length && !day.article && !Object.keys(day.dictation).length))))
            && JSON.stringify(item.speech) === JSON.stringify(DEFAULT_SPEECH);
        }, localStorage, transport,
        payload => {
          const item = JSON.parse(payload) as PetProgress;
          if (!item || !item.ratings || !Array.isArray(item.reviews)) throw new Error("Invalid cloud data");
          localStorage.setItem(progressStorageKey(currentUsername), payload);
          setProgress(loadProgress(currentUsername));
        }, setSyncStatus);
      syncRef.current = sync;
    } catch { setSyncStatus("error"); return; }
    const refresh = (): void => { void sync.sync(); };
    const timer = window.setTimeout(refresh, 1500);
    const poll = window.setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      sync.dispose();
      syncRef.current = null;
    };
  }, [currentUsername]);

  useEffect(() => { setSpeechPreferences(progress.speech); }, [progress.speech]);

  useEffect(() => {
    if (currentUsername && progressOwner === currentUsername) {
      try {
        const payload = JSON.stringify({ ...progress, schedule });
        syncRef.current?.stage(payload);
        localStorage.setItem(progressStorageKey(currentUsername), payload);
      } catch {
        setNotice("保存失败：设备存储空间不足，请在离开前导出备份");
      }
    }
  }, [currentUsername, progressOwner, progress, schedule]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const rateWord = useCallback((word: PetWord, rating: Rating, scheduled: boolean) => {
    if (localDateKey() !== today) { setToday(localDateKey()); return; }
    setProgress((previous) => {
      const today = localDateKey();
      const isNewDay = previous.lastStudyDate !== today;
      const nextStreak = isNewDay
        ? previous.lastStudyDate === previousDateKey()
          ? previous.streak + 1
          : 1
        : previous.streak;

      let nextSchedule = ensureSchedule(previous.schedule, previous.ratings, today, previous.appliedVocabulary, studyPool(previous.savedWords));
      if (scheduled) {
        const { cycle, day, dayIndex } = currentStudyDay(nextSchedule, today);
        if (!day.wordIds.includes(word.id)) return previous;
        nextSchedule = updateStudyDay(nextSchedule, cycle.number, dayIndex, (item) => ({ ...item, ratings: { ...item.ratings, [word.id]: rating } }));
      }
      return {
        ...previous,
        activeIndex: (previous.activeIndex + 1) % PET_STUDY_WORDS.length,
        ratings: { ...previous.ratings, [word.id]: rating },
        schedule: nextSchedule,
        reviews: [
          ...previous.reviews.slice(-499),
          { wordId: word.id, rating, date: today, at: Date.now() },
        ],
        streak: nextStreak,
        lastStudyDate: today,
      };
    });
    setNotice(rating === "known" ? "已掌握，继续保持" : rating === "learning" ? "已加入巩固计划" : "已加入错词本");
  }, [today]);

  const updateSchedule = useCallback((update: (schedule: StudySchedule) => StudySchedule) => {
    if (progressOwnerRef.current !== currentUsername) return;
    setProgress((previous) => ({ ...previous, schedule: update(ensureSchedule(previous.schedule, previous.ratings, localDateKey(), previous.appliedVocabulary, studyPool(previous.savedWords))) }));
  }, [currentUsername]);

  function markVocabulary(word: PetWord, status: VocabularyStatus): void {
    setProgress(previous => {
      const vocabulary = { ...previous.vocabulary, [word.id]: status };
      const savedWords = word.id >= 1000 && !previous.savedWords.some(item => item.id === word.id) ? [...previous.savedWords, word] : previous.savedWords;
      return { ...previous, vocabulary, savedWords };
    });
    setNotice(status === "known" ? "已移入认识列表" : "已标记不认识，点击“增加”更新学习计划");
  }

  function addVocabularyToStudy(): void {
    setProgress(previous => {
      const ratings = { ...previous.ratings };
      for (const [id, status] of Object.entries(previous.vocabulary)) {
        const hasStudyRecord = previous.schedule?.cycles.some(cycle => cycle.days.some(day => day.ratings[Number(id)]));
        if (status === "unknown" && (previous.appliedVocabulary[Number(id)] !== "unknown" || !hasStudyRecord)) delete ratings[Number(id)];
      }
      const appliedVocabulary = { ...previous.vocabulary };
      return { ...previous, ratings, appliedVocabulary, schedule: ensureSchedule(previous.schedule, ratings, localDateKey(), appliedVocabulary, studyPool(previous.savedWords)) };
    });
    setToday(localDateKey());
    setPracticeWord(null);
    setTab("study");
    setNotice("学习计划已更新：按每日名额安排，已完成的任务保留");
  }

  function openWord(word: PetWord): void {
    if (word.id >= 1000) setProgress(previous => previous.savedWords.some(item => item.id === word.id) ? previous : { ...previous, savedWords: [...previous.savedWords, word] });
    setPracticeWord(word);
    setTab("study");
  }

  function handleLogin(user: PetUser): void {
    setCurrentUser(user);
  }

  function handleLogout(): void {
    stopSpeech();
    void clearPetSession().finally(() => setCurrentUser(null));
  }

  if (!authReady) return <AuthLoadingView />;
  if (!currentUser) return <LoginView onLogin={handleLogin} />;
  if (progressOwner !== currentUsername) return <AuthLoadingView />;

  return (
    <div className="pet-app">
      <header className="pet-header">
        <div className="pet-header__inner">
          <button className="pet-brand" type="button" onClick={() => setTab("study")} aria-label="回到学习页">
            <span className="pet-brand__mark"><BookOpen aria-hidden="true" /></span>
            <span>PET词汇精读</span>
          </button>
          <div className="pet-greeting">
            <span>早上好，今天继续进步</span>
            <strong>今日 {studiedToday} / {activeDay.wordIds.length}</strong>
            <button type="button" className="pet-user-button" onClick={() => setTab("profile")} aria-label="打开用户中心">
              {currentUser.username}
            </button>
          </div>
        </div>
      </header>

      <main className="pet-main">
        <SpeechFeedback />
        {dailyReturn && tab !== "preparation" && <div className="pet-writing pet-writing-notice"><button onClick={() => { setPrepPanel("today"); setTab("preparation"); }}>返回今日任务</button><p>完成并提交后返回清单核对；仅打开页面不算完成。</p></div>}
        {tab === "study" && (
          <WeeklyStudy
            wordPool={wordPool}
            key={`${currentUser.username}:${today}`}
            username={currentUser.username}
            today={today}
            schedule={schedule}
            onUpdate={updateSchedule}
            onRate={rateWord}
            practiceWord={practiceWord}
            onPracticeWord={setPracticeWord}
          />
        )}
        {tab === "library" && <LibraryView ratings={progress.ratings} vocabulary={progress.vocabulary} onAdd={addVocabularyToStudy} unknownCount={wordPool.filter(word => progress.vocabulary[word.id] === "unknown").length} onMark={markVocabulary} onOpenWord={openWord} />}
        {tab === "reading" && <ReadingView username={currentUser.username} onOpenWord={openWord} />}
        {tab === "writing" && <WritingView key={currentUser.username} username={currentUser.username} onOpenLessons={() => { setPrepPanel("composition"); setTab("preparation"); }} />}
        {tab === "preparation" && <Suspense fallback={<p role="status">正在打开备考内容…</p>}><PreparationView key={currentUser.username} username={currentUser.username} initialPanel={prepPanel} today={today} words={schedule.cycles.flatMap(cycle => cycle.days.map((day,index) => { const d = new Date(cycle.startDate + "T12:00:00"); d.setDate(d.getDate()+index); return { date:localDateKey(d), complete:day.wordIds.length>0 && day.wordIds.every(id=>!!day.ratings[id] && !!day.dictation[id]), text:JSON.stringify(day.wordIds.map(id=>({ word:wordPool.find(w=>w.id===id)?.word ?? String(id), meaning:wordPool.find(w=>w.id===id)?.meaning ?? "", rating:day.ratings[id] ?? "未提交", dictation:day.dictation[id] ?? "未提交" })),null,2) }; }))} onDailyNavigate={next => { setDailyReturn(true); setTab(next); }} onNavigate={next => { setDailyReturn(true); setPrepPanel("today"); setTab(next); }} /></Suspense>}
        {tab === "wrong" && <WrongView wordPool={wordPool} ratings={progress.ratings} onOpenWord={openWord} />}
        {tab === "profile" && <div className="pet-page"><CloudSyncPanel username={currentUser.username} status={syncStatus} onSync={() => void syncRef.current?.sync()} onResolve={choice => void syncRef.current?.resolve(choice)} /><ProfileView user={currentUser} progress={progress} onRestore={setProgress} onLogout={handleLogout} /><SpeechSettingsPanel value={progress.speech} onChange={speech => setProgress(previous => ({ ...previous, speech }))} /></div>}
      </main>

      <nav className="pet-bottom-nav" aria-label="主要导航">
        <div className="pet-bottom-nav__inner">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={tab === id ? "is-active" : ""}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {id === "wrong" && Object.values(progress.ratings).filter((rating) => rating !== "known").length > 0 && (
                <i aria-label="有待复习单词" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {notice && <div className="pet-toast" role="status"><Check aria-hidden="true" />{notice}</div>}
    </div>
  );
}

function AuthLoadingView(): JSX.Element {
  return (
    <main className="pet-login">
      <section className="pet-login__panel pet-login__loading" aria-live="polite">
        <LoaderCircle aria-hidden="true" />
        <strong>正在验证登录状态...</strong>
      </section>
    </main>
  );
}

function LoginView({ onLogin }: { onLogin: (user: PetUser) => void }): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await authenticatePetUser(username, password);
    setSubmitting(false);
    if (!result.user) {
      setError(result.error ?? "登录失败，请稍后再试");
      return;
    }
    onLogin(result.user);
  }

  return (
    <main className="pet-login">
      <section className="pet-login__panel" aria-labelledby="login-title">
        <div className="pet-login__brand"><span><BookOpen aria-hidden="true" /></span><strong>PET词汇精读</strong></div>
        <div className="pet-login__intro">
          <span>欢迎回来</span>
          <h1 id="login-title">登录后开始学习</h1>
          <p>每个账号的单词进度和精读资料独立保存在当前设备。</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="pet-username">用户名</label>
          <input id="pet-username" value={username} onChange={(event) => setUsername(event.target.value.toUpperCase())} autoComplete="username" placeholder="例如 RUN1" autoCapitalize="characters" />
          <label htmlFor="pet-password">密码</label>
          <div className="pet-password-field">
            <input id="pet-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入密码" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          {error ? <p className="pet-login__error" role="alert">{error}</p> : null}
          <button type="submit" className="pet-login__submit" disabled={submitting || !isPetAuthConfigured}>
            {submitting ? <><LoaderCircle aria-hidden="true" />正在验证...</> : "登录"}
          </button>
        </form>
        <div className="pet-login__hint">
          <ShieldCheck aria-hidden="true" />
          <span>{isPetAuthConfigured ? "账号由 Supabase Auth 安全验证，登录会话只保存在当前设备。" : "安全登录尚未完成配置，管理员设置 Supabase 后即可使用。"}</span>
        </div>
      </section>
    </main>
  );
}

function LibraryView({ ratings, vocabulary, onAdd, unknownCount, onMark, onOpenWord }: { onAdd: () => void; unknownCount: number; ratings: Record<number, Rating>; vocabulary: VocabularyChoices; onMark: (word: PetWord, status: VocabularyStatus) => void; onOpenWord: (word: PetWord) => void }): JSX.Element {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | VocabularyStatus>("all");
  const [visibleCount, setVisibleCount] = useState(100);
  const [lexicon, setLexicon] = useState<"curated" | "b1">("curated");
  const [b1Words, setB1Words] = useState<B1Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (lexicon !== "b1" || b1Words.length > 0) return;
    setLoading(true);
    setLoadError("");
    void loadB1Words()
      .then(setB1Words)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "扩展词库加载失败"))
      .finally(() => setLoading(false));
  }, [b1Words.length, lexicon]);

  const filteredCurated = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PET_WORDS.filter((word) => (filter === "all" || vocabulary[word.id] === filter) && (!needle || word.word.includes(needle) || word.meaning.includes(needle)));
  }, [query, filter, vocabulary]);

  const filteredB1 = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return b1Words.map(asStudyWord).filter(word => (filter === "all" || vocabulary[word.id] === filter) && (!needle || word.word.toLowerCase().includes(needle) || word.meaning.includes(needle)));
  }, [b1Words, query, filter, vocabulary]);
  const currentWords = lexicon === "curated" ? PET_WORDS : b1Words.map(asStudyWord);

  return (
    <section className="pet-page">
      <PageHeading eyebrow="选择不同词库" title="词库中心" description="核心词库按主题学习；扩展词库提供完整的 2354 个 CEFR B1 词条。" />
      <div className="pet-lexicon-picker" role="radiogroup" aria-label="选择词库">
        <button type="button" role="radio" aria-checked={lexicon === "curated"} className={lexicon === "curated" ? "is-active" : ""} onClick={() => { setLexicon("curated"); setQuery(""); }}>
          <span><BookMarked aria-hidden="true" /></span><div><strong>PET 核心分类词库</strong><p>{PET_WORDS.length} 词 · {PET_CATEGORIES.length} 个记忆主题</p></div><Check aria-hidden="true" />
        </button>
        <button type="button" role="radio" aria-checked={lexicon === "b1"} className={lexicon === "b1" ? "is-active" : ""} onClick={() => { setLexicon("b1"); setQuery(""); }}>
          <span><LibraryBig aria-hidden="true" /></span><div><strong>PET/B1 扩展词库</strong><p>{B1_WORD_COUNT} 词 · CEFR B1 开放词表</p></div><Check aria-hidden="true" />
        </button>
      </div>
      <div className="pet-vocabulary-filters" role="group" aria-label="单词掌握状态">
        {(["all", "known", "unknown"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : value === "known" ? "认识" : "不认识"}<strong>{value === "all" ? currentWords.length : currentWords.filter(word => vocabulary[word.id] === value).length}</strong></button>)}
      </div>
      <div className="pet-add-vocabulary"><div><strong>待安排词库：{unknownCount} 个不认识的单词</strong><p>标记完成后点击“增加”，将两个词库中的不认识单词更新到学习计划。按每日名额分配，已完成的任务保留。</p></div><AddVocabularyButton onAdd={onAdd} /></div>
      <div className="pet-library-summary"><strong>{lexicon === "curated" ? PET_WORDS.length : B1_WORD_COUNT}</strong><span>当前词库词量</span><small>{lexicon === "curated" ? "标记后进入每日计划" : "标记后进入每日计划"}</small></div>
      <label className="pet-search"><Search aria-hidden="true" /><span className="sr-only">搜索单词</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文释义" /></label>
      {loading ? <div className="pet-loading"><LoaderCircle aria-hidden="true" />正在加载 2354 个词条…</div> : null}
      {loadError ? <p className="pet-inline-error" role="alert">{loadError}</p> : null}
      <div className="pet-library-list">
        {(lexicon === "curated" ? filteredCurated : filteredB1.slice(0, visibleCount)).map((word) => {
          const rating = vocabulary[word.id] === "known" ? "known" : vocabulary[word.id] === "unknown" ? "again" : ratings[word.id];
          return (
            <div className="pet-vocabulary-row" key={word.id}><button className="pet-vocabulary-open" type="button" onClick={() => onOpenWord(word)}>
              <span className={`pet-word-status pet-word-status--${rating ?? "new"}`} aria-hidden="true" />
              <span><strong>{word.word}</strong><small>{word.ipa} · {word.category}</small></span>
              <span>{word.partOfSpeech} {word.meaning}</span>
              <ChevronRight aria-hidden="true" />
            </button><div className="pet-vocabulary-actions">{vocabulary[word.id] === "known" ? <button type="button" onClick={() => onMark(word, "unknown")} aria-label={`恢复 ${word.word}`}>恢复</button> : <><button type="button" onClick={() => onMark(word, "known")} aria-label={`认识 ${word.word}`}>认识</button><button type="button" disabled={vocabulary[word.id] === "unknown"} onClick={() => onMark(word, "unknown")} aria-label={`不认识 ${word.word}`}>{vocabulary[word.id] === "unknown" ? "已标记" : "不认识"}</button></>}</div></div>
          );
        })}
      </div>
      {!loading && !(lexicon === "curated" ? filteredCurated : filteredB1).length ? <p className="pet-library-note">此列表暂无单词。可切换“全部”标记单词，或调整搜索内容。</p> : null}
      {lexicon === "b1" && filteredB1.length > visibleCount ? <div className="pet-vocabulary-filters"><button type="button" onClick={() => setVisibleCount(value => value + 100)}>加载更多单词（已显示 {visibleCount} / {filteredB1.length}）</button></div> : null}
      {lexicon === "b1" ? <p className="pet-library-source">数据来自开放的 CEFR B1 词表，并非 Cambridge 官方词表；详细许可见 data/ATTRIBUTION.md。</p> : null}
    </section>
  );
}

function ReadingView({ username, onOpenWord }: { username: string; onOpenWord: (word: PetWord) => void }): JSX.Element {
  const [documents, setDocuments] = useState<ReadingDocument[]>(() => loadReadingDocuments(username));
  const [mode, setMode] = useState<ReadingMode>("reading");
  const [activeDocument, setActiveDocument] = useState<ReadingDocument | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState("");
  const [resourceId, setResourceId] = useState(() => loadListeningResourceId(username));
  const [audioError, setAudioError] = useState("");
  const resource = LISTENING_RESOURCES.find((item) => item.id === resourceId) ?? LISTENING_RESOURCES[0];
  const effectiveResource = LISTENING_RESOURCES.find((item) => item.id === activeDocument?.listeningResourceId) ?? resource;
  const audioSource = audioUrl ?? (activeDocument && !activeDocument.listeningResourceId ? undefined : effectiveResource.audioUrl);
  const [selectedWord, setSelectedWord] = useState<PetWord | null>(null);
  const [speed, setSpeed] = useState<(typeof READING_SPEEDS)[number]>(1);
  const [processing, setProcessing] = useState(false);
  const [importError, setImportError] = useState("");
  const [listeningRanges, setListeningRanges] = useState<Record<number, ListeningRange>>({});
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [loopSentence, setLoopSentence] = useState(true);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [dictationIndex, setDictationIndex] = useState<number | null>(null);
  const [dictationAnswer, setDictationAnswer] = useState("");
  const [dictationResult, setDictationResult] = useState<"correct" | "incorrect" | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAudioTimeRef = useRef(-1);
  const importSequence = useRef(0);

  useEffect(() => () => { importSequence.current++; }, []);

  useEffect(() => {
    localStorage.setItem(`pet-listening-resource-v1-${username}`, resourceId);
  }, [resourceId, username]);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    stopSpeech();
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [audioSource, speed, mode]);

  function changeMode(nextMode: ReadingMode): void {
    importSequence.current++;
    setProcessing(false);
    setImportError("");
    setMode(nextMode);
    setActiveDocument(nextMode === "listening" ? documents.find((item) => item.listeningResourceId === resourceId) ?? null : null);
    if (nextMode === "listening") { setAudioUrl(null); setAudioName(""); setAudioError(""); }
    setSelectedWord(null);
    setActiveSentenceIndex(null);
    setDictationIndex(null);
    setDictationAnswer("");
    setDictationResult(null);
    audioRef.current?.pause();
    stopSpeech();
  }

  function chooseResource(next: ListeningResource): void {
    importSequence.current++;
    setProcessing(false);
    setImportError("");
    setAudioError("");
    audioRef.current?.pause();
    setResourceId(next.id);
    setAudioUrl(null);
    setAudioName("");
    setActiveDocument(documents.find((item) => item.listeningResourceId === next.id) ?? null);
    setCurrentAudioTime(0);
    setActiveSentenceIndex(null);
  }

  function openSavedDocument(document: ReadingDocument): void {
    importSequence.current++;
    setProcessing(false);
    setImportError("");
    if (document.mode === "listening") {
      const paired = LISTENING_RESOURCES.find((item) => item.id === document.listeningResourceId);
      if (paired) chooseResource(paired);
      else { setAudioUrl(null); setAudioName(""); setAudioError(""); }
    }
    setActiveDocument(document);
  }

  async function importOfficialResource(): Promise<void> {
    if (processing) return;
    const sequence = ++importSequence.current;
    const selectedResource = resource;
    setProcessing(true);
    setImportError("");
    try {
      const response = await fetch(listeningPdfUrl(selectedResource), { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("原文下载失败，请稍后重试，或从官网保存 PDF 后手动导入。");
      const blob = await response.blob();
      const file = new File([blob], selectedResource.pdfFile, { type: "application/pdf" });
      const parsed = await parseReadingFile(file, "listening");
      if (sequence !== importSequence.current) return;
      const document = { ...parsed, id: `official-${selectedResource.id}`, title: selectedResource.title, listeningResourceId: selectedResource.id };
      setDocuments(saveReadingDocument(username, document));
      setActiveDocument(document);
      setAudioUrl(null);
      setAudioName("");
      setAudioError("");
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = selectedResource.pdfFile;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      if (sequence === importSequence.current) setImportError(error instanceof Error ? error.message : "原文导入失败，请重试。");
    } finally {
      if (sequence === importSequence.current) setProcessing(false);
    }
  }

  useEffect(() => {
    if (mode === "listening" && activeDocument) {
      setListeningRanges(loadListeningRanges(username, activeDocument.id));
    } else {
      setListeningRanges({});
    }
    setActiveSentenceIndex(null);
    setDictationIndex(null);
    setDictationAnswer("");
    setDictationResult(null);
  }, [activeDocument, mode, username]);

  async function importDocument(file: File | undefined): Promise<void> {
    if (!file) return;
    const sequence = ++importSequence.current;
    setProcessing(true);
    setImportError("");
    try {
      const parsed = await parseReadingFile(file, mode);
      if (sequence !== importSequence.current) return;
      const paired = mode === "listening" ? resourceForFile(file.name) : undefined;
      const document = paired ? { ...parsed, id: `official-${paired.id}`, title: paired.title, listeningResourceId: paired.id } : parsed;
      setDocuments(saveReadingDocument(username, document));
      setActiveDocument(document);
      if (mode === "listening") {
        if (paired) setResourceId(paired.id);
        setAudioUrl(null);
        setAudioName("");
        setAudioError("");
      }
    } catch (error) {
      if (sequence === importSequence.current) setImportError(error instanceof Error ? error.message : "文件读取失败");
    } finally {
      if (sequence === importSequence.current) setProcessing(false);
    }
  }

  function importAudio(file: File | undefined): void {
    if (!file) return;
    setAudioError("");
    setActiveSentenceIndex(null);
    setAudioName(file.name);
    setAudioUrl(URL.createObjectURL(file));
  }

  function deleteDocument(id: string): void {
    setDocuments(removeReadingDocument(username, id));
    if (activeDocument?.id === id) setActiveDocument(null);
  }

  function updateListeningRange(index: number, patch: Partial<ListeningRange>): void {
    if (!activeDocument) return;
    setListeningRanges((current) => {
      const previous = current[index] ?? { start: 0, end: 0 };
      const next = { ...current, [index]: { ...previous, ...patch } };
      localStorage.setItem(listeningRangesStorageKey(username, activeDocument.id), JSON.stringify(next));
      return next;
    });
  }

  function selectSentenceForTiming(index: number): void {
    setActiveSentenceIndex(index);
    setDictationIndex(null);
    setDictationResult(null);
    setImportError("");
  }

  function playOriginalSentence(index: number): void {
    const range = listeningRanges[index];
    const player = audioRef.current;
    setActiveSentenceIndex(index);
    if (!player || !range || range.end <= range.start) {
      setImportError(`请先点击“配置第 ${index + 1} 句时间”，设置句首和句尾。`);
      return;
    }
    setImportError("");
    try {
      player.currentTime = range.start;
      player.playbackRate = speed;
      void player.play().catch(() => setImportError("音频暂时无法播放，请检查网络或重新导入本地音频。"));
    } catch {
      setImportError("音频尚未准备好，请稍等片刻或重新导入本地音频。");
    }
  }

  function handleAudioTimeUpdate(): void {
    const player = audioRef.current;
    if (!player) return;
    if (Math.abs(player.currentTime - lastAudioTimeRef.current) >= 0.1) {
      lastAudioTimeRef.current = player.currentTime;
      setCurrentAudioTime(player.currentTime);
    }
    if (activeSentenceIndex === null) return;
    const range = listeningRanges[activeSentenceIndex];
    if (!range || range.end <= range.start || player.currentTime < range.end) return;
    if (loopSentence) {
      player.currentTime = range.start;
      void player.play();
    } else {
      player.pause();
      player.currentTime = range.end;
    }
  }

  function openDictation(index: number): void {
    setActiveSentenceIndex(index);
    setDictationIndex(index);
    setDictationAnswer("");
    setDictationResult(null);
    playOriginalSentence(index);
  }

  const documentsForMode = documents.filter((document) => document.mode === mode);
  const readingText = activeDocument?.content ?? (mode === "reading" ? PET_READING.paragraphs.join(" ") : "");
  const sentences = useMemo(() => splitIntoSentences(readingText), [readingText]);
  const isListening = mode === "listening";
  const activeRange = activeSentenceIndex === null ? null : listeningRanges[activeSentenceIndex] ?? { start: 0, end: 0 };
  const dictationSentence = dictationIndex === null ? "" : sentences[dictationIndex] ?? "";

  return (
    <section className="pet-page">
      <div className="pet-reading-modes" role="tablist" aria-label="精读类型">
        <button type="button" role="tab" aria-selected={mode === "reading"} className={mode === "reading" ? "is-active" : ""} onClick={() => changeMode("reading")}><BookOpen aria-hidden="true" /><span><strong>阅读精读</strong><small>文章 · 生词 · 逐句理解</small></span></button>
        <button type="button" role="tab" aria-selected={mode === "listening"} className={mode === "listening" ? "is-active" : ""} onClick={() => changeMode("listening")}><Headphones aria-hidden="true" /><span><strong>听力精读</strong><small>原版音频 · 原文 · 倍速</small></span></button>
      </div>
      <PageHeading
        eyebrow={isListening ? "PET 原版听力精练" : "PET 难度阅读精练"}
        title={isListening ? "听力精读" : "阅读精读"}
        description={isListening ? "使用 Cambridge 官网当前公开样题，或导入自己的音频与听力原文。" : "导入 TXT、Word 或 PDF 文章，逐句理解并积累重点词汇。"}
      />

      {isListening ? (
        <section className="pet-official-resource" aria-label="Cambridge 官方听力资料">
          <div className="pet-official-resource__meta"><span>官网当前公开版本</span><strong>2026-09 已核对</strong></div>
          <label className="pet-listening-select">选择听力资料<select value={resourceId} onChange={(event) => chooseResource(LISTENING_RESOURCES.find((item) => item.id === event.target.value)!)}>{LISTENING_RESOURCES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <div className="pet-official-resource__heading"><div><small>Cambridge English</small><h2>{resource.title}</h2><p>点击下方按钮即可保存 PDF 并自动导入原文，同时加载这套资料的官方音频。音频加载后请点击播放。</p></div><ShieldCheck aria-hidden="true" /></div>
          <div className="pet-official-resource__links">
            <a href={CAMBRIDGE_LISTENING_PAGE} target="_blank" rel="noreferrer">官方备考页<ExternalLink aria-hidden="true" /></a>
            <button type="button" disabled={processing} onClick={() => void importOfficialResource()}>{processing ? "正在导入…" : "下载并导入原文 PDF"}<Download aria-hidden="true" /></button>
            <a href={resource.sourcePdfUrl} target="_blank" rel="noreferrer">官网 PDF 备用链接<ExternalLink aria-hidden="true" /></a>
          </div>
        </section>
      ) : null}

      <div className="pet-import-row">
        <label><Upload aria-hidden="true" />{isListening ? "导入听力原文" : "导入阅读文章"}<input type="file" accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void importDocument(event.target.files?.[0])} /></label>
        {isListening ? <label><FileAudio aria-hidden="true" />导入自己的音频<input type="file" accept="audio/*" onChange={(event) => importAudio(event.target.files?.[0])} /></label> : null}
      </div>
      {processing ? <div className="pet-loading"><LoaderCircle aria-hidden="true" />正在本地解析文档…</div> : null}
      {importError ? <p className="pet-inline-error" role="alert">{importError}</p> : null}

      {documentsForMode.length > 0 ? (
        <section className="pet-saved-readings" aria-label="已保存精读资料">
          <div><FileText aria-hidden="true" /><strong>{isListening ? "已保存听力原文" : "已保存阅读文章"}</strong><span>{documentsForMode.length} / 8</span></div>
          <div className="pet-saved-readings__list">
            {documentsForMode.map((document) => (
              <div className={activeDocument?.id === document.id ? "is-active" : ""} key={document.id}>
                <button type="button" onClick={() => openSavedDocument(document)} aria-label={`打开已保存文档 ${document.title}`}><strong>{document.title}</strong><small>{document.sourceType.toUpperCase()}</small></button>
                <button type="button" onClick={() => deleteDocument(document.id)} aria-label={`删除 ${document.title}`}><Trash2 aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pet-speed-control pet-speed-control--standalone" role="group" aria-label="朗读速度">
        <span><Gauge aria-hidden="true" />播放速度</span>
        {READING_SPEEDS.map((option) => <button type="button" aria-pressed={speed === option} className={speed === option ? "is-active" : ""} key={option} onClick={() => setSpeed(option)}>{option}x</button>)}
      </div>

      {isListening ? <div className="pet-audio pet-audio--official"><Headphones aria-hidden="true" /><div><strong>{audioName || (audioSource ? `${effectiveResource.title} · 官方音频` : "请导入与这份原文对应的音频")}</strong><small>{audioUrl ? "本地导入 · 仅本次会话" : audioSource ? "已关联官方原版音频 · 联网后点击播放" : "自选资料无法仅凭 PDF 自动识别对应录音"}</small>{audioSource ? <audio key={audioSource} ref={audioRef} controls preload="metadata" src={audioSource} onLoadedMetadata={() => { if (audioRef.current) audioRef.current.playbackRate = speed; setAudioError(""); }} onError={() => setAudioError("官方音频暂时无法加载，请检查网络，或导入对应的本地音频。")} onTimeUpdate={handleAudioTimeUpdate}>浏览器不支持音频播放。</audio> : null}{audioError ? <p className="pet-inline-error">{audioError}</p> : null}</div></div> : null}

      {isListening && activeDocument ? (
        <section className="pet-segment-workbench" aria-label="原版音频单句配置">
          <div className="pet-segment-workbench__heading"><div><Settings2 aria-hidden="true" /><span><strong>单句时间轴</strong><small>播放器当前时间 {formatAudioTime(currentAudioTime)}</small></span></div><button type="button" className={loopSentence ? "is-active" : ""} aria-pressed={loopSentence} onClick={() => setLoopSentence((value) => !value)}><Repeat2 aria-hidden="true" />单句循环</button></div>
          {activeSentenceIndex === null || !activeRange ? <p>点击下方任意句子右侧的“配置”按钮，再播放音频并分别记录句首、句尾。</p> : (
            <div className="pet-segment-editor">
              <strong>第 {activeSentenceIndex + 1} 句</strong>
              <label>句首（秒）<input aria-label={`第 ${activeSentenceIndex + 1} 句句首时间`} type="number" min="0" step="0.1" value={activeRange.start} onChange={(event) => updateListeningRange(activeSentenceIndex, { start: Math.max(0, Number(event.target.value)) })} /></label>
              <button type="button" onClick={() => updateListeningRange(activeSentenceIndex, { start: Number(currentAudioTime.toFixed(1)) })}>当前位置设为句首</button>
              <label>句尾（秒）<input aria-label={`第 ${activeSentenceIndex + 1} 句句尾时间`} type="number" min="0" step="0.1" value={activeRange.end} onChange={(event) => updateListeningRange(activeSentenceIndex, { end: Math.max(0, Number(event.target.value)) })} /></label>
              <button type="button" onClick={() => updateListeningRange(activeSentenceIndex, { end: Number(currentAudioTime.toFixed(1)) })}>当前位置设为句尾</button>
              <span>自动保存</span>
            </div>
          )}
        </section>
      ) : null}

      {!isListening || activeDocument ? <article className="pet-reading-card">
        <div className="pet-reading-card__heading">
          <div><span>{activeDocument ? `${activeDocument.sourceType.toUpperCase()} · 本地资料` : "Reading · PET/B1"}</span><h2>{activeDocument?.title ?? PET_READING.title}</h2></div>
          <button type="button" onClick={() => speak(readingText, speed)}><Volume2 aria-hidden="true" />{isListening ? "朗读原文" : "朗读全文"}</button>
        </div>
        <div className="pet-sentence-list">
          {sentences.map((sentence, sentenceIndex) => (
            <ReadingSentence
              key={`${sentence.slice(0, 20)}-${sentenceIndex}`}
              sentence={sentence}
              index={sentenceIndex}
              speed={speed}
              onSelectWord={setSelectedWord}
              listening={isListening}
              configured={isValidListeningRange(listeningRanges[sentenceIndex])}
              active={activeSentenceIndex === sentenceIndex}
              onPlayOriginal={() => playOriginalSentence(sentenceIndex)}
              onConfigure={() => selectSentenceForTiming(sentenceIndex)}
              onDictation={() => openDictation(sentenceIndex)}
            />
          ))}
        </div>
        {isListening && dictationIndex !== null && dictationSentence ? (
          <section className="pet-dictation" aria-label={`第 ${dictationIndex + 1} 句听写`}>
            <div><span>听写填空 · 第 {dictationIndex + 1} 句</span><button type="button" onClick={() => playOriginalSentence(dictationIndex)}><Volume2 aria-hidden="true" />再听一遍</button></div>
            <p>{createDictationPrompt(dictationSentence)}</p>
            <label>输入完整句子<textarea value={dictationAnswer} onChange={(event) => { setDictationAnswer(event.target.value); setDictationResult(null); }} placeholder="根据音频输入完整英文句子" /></label>
            <div className="pet-dictation__actions"><button type="button" onClick={() => setDictationResult(normalizeDictation(dictationAnswer) === normalizeDictation(dictationSentence) ? "correct" : "incorrect")}>检查答案</button>{dictationResult ? <strong className={`is-${dictationResult}`} role="status">{dictationResult === "correct" ? "正确！继续下一句" : "还不完全正确，再听一次或查看原句"}</strong> : null}</div>
            {dictationResult === "incorrect" ? <details><summary>查看原句</summary><p>{dictationSentence}</p></details> : null}
          </section>
        ) : null}
        {!activeDocument && !isListening ? <details><summary>查看中文大意</summary><p>{PET_READING.translation}</p></details> : null}
      </article> : (
        <section className="pet-transcript-empty">
          <FileText aria-hidden="true" />
          <div><h2>导入原文后开始逐句精听</h2><p>先在上方选择一套资料，再点击“下载并导入原文 PDF”。原文会自动拆分句子并保存，官方音频也会同步切换。</p></div>
          <button type="button" disabled={processing} onClick={() => void importOfficialResource()}>导入所选官方原文<Download aria-hidden="true" /></button>
        </section>
      )}
      {selectedWord ? (
        <div className="pet-reading-word" role="status">
          <button type="button" className="pet-reading-word__close" onClick={() => setSelectedWord(null)} aria-label="关闭"><X aria-hidden="true" /></button>
          <div><strong>{selectedWord.word}</strong><span>{selectedWord.ipa}</span><p>{selectedWord.partOfSpeech} {selectedWord.meaning}</p></div>
          <button type="button" onClick={() => speak(selectedWord.word)} aria-label="播放单词"><Volume2 aria-hidden="true" /></button>
          <button type="button" onClick={() => onOpenWord(selectedWord)}>去学习</button>
        </div>
      ) : null}
    </section>
  );
}

function ReadingSentence({ sentence, index, speed, onSelectWord, listening = false, configured = false, active = false, onPlayOriginal, onConfigure, onDictation }: { sentence: string; index: number; speed: number; onSelectWord: (word: PetWord) => void; listening?: boolean; configured?: boolean; active?: boolean; onPlayOriginal?: () => void; onConfigure?: () => void; onDictation?: () => void }): JSX.Element {
  return (
    <div className={`pet-sentence${listening ? " pet-sentence--listening" : ""}${active ? " is-active" : ""}`}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <p>{sentence.split(/(\b[A-Za-z]+\b)/).map((token, tokenIndex) => {
        const word = PET_WORD_MAP.get(token.toLowerCase());
        return word ? <button type="button" key={`${token}-${tokenIndex}`} onClick={() => onSelectWord(word)}>{token}</button> : token;
      })}</p>
      {listening ? <div className="pet-sentence__tools">
        <button type="button" className={configured ? "is-configured" : ""} onClick={onPlayOriginal} aria-label={`播放原音第 ${index + 1} 句`}><Play aria-hidden="true" /></button>
        <button type="button" onClick={onConfigure} aria-label={`配置第 ${index + 1} 句时间`}><Settings2 aria-hidden="true" /></button>
        <button type="button" onClick={onDictation} aria-label={`听写第 ${index + 1} 句`}><BookMarked aria-hidden="true" /></button>
      </div> : <button type="button" onClick={() => speak(sentence, speed)} aria-label={`播放第 ${index + 1} 句`}><Volume2 aria-hidden="true" /></button>}
    </div>
  );
}

function WrongView({ wordPool, ratings, onOpenWord }: { wordPool: PetWord[]; ratings: Record<number, Rating>; onOpenWord: (word: PetWord) => void }): JSX.Element {
  const words = wordPool.filter((word) => ratings[word.id] === "again" || ratings[word.id] === "learning");
  return (
    <section className="pet-page">
      <PageHeading eyebrow={`${words.length} 个待巩固词`} title="错词本" description="不认识和有点熟的词会自动来到这里。" />
      {words.length === 0 ? (
        <div className="pet-empty"><span><BookMarked aria-hidden="true" /></span><h2>错词本还是空的</h2><p>学习时选择“不认识”或“有点熟”，单词就会自动加入。</p></div>
      ) : (
        <>
          <button type="button" className="pet-primary-action" onClick={() => onOpenWord(words[0])}><Play aria-hidden="true" />开始复习错词</button>
          <div className="pet-wrong-grid">
            {words.map((word) => <button type="button" key={word.id} onClick={() => onOpenWord(word)}><strong>{word.word}</strong><span>{word.ipa}</span><p>{word.meaning}</p><small>{ratings[word.id] === "again" ? "不认识" : "有点熟"}</small></button>)}
          </div>
        </>
      )}
    </section>
  );
}

function ProfileView({ user, progress, onRestore, onLogout }: { user: PetUser; progress: PetProgress; onRestore: (progress: PetProgress) => void; onLogout: () => void }): JSX.Element {
  const importRef = useRef<HTMLInputElement>(null);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const knownCount = Object.values(progress.ratings).filter((rating) => rating === "known").length;
  const reviewCount = Object.values(progress.ratings).filter((rating) => rating !== "known").length;

  function exportProgress(): void {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pet-vocab-${user.username}-${localDateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function restoreProgress(file: File | undefined): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as PetProgress;
        if (!next.ratings || !Array.isArray(next.reviews)) throw new Error("invalid");
        onRestore({ ...EMPTY_PROGRESS, ...next, speech: readSpeechSettings(next.speech), savedWords: readSavedWords(next.savedWords), vocabulary: next.vocabulary ?? {}, appliedVocabulary: next.appliedVocabulary ?? next.vocabulary ?? {}, schedule: readSchedule(next.schedule, studyPool(readSavedWords(next.savedWords))) });
      } catch {
        window.alert("备份文件无法识别，请选择本应用导出的 JSON 文件。");
      }
    };
    reader.readAsText(file);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (nextPassword.length < 8) {
      setPasswordNotice("新密码至少需要 8 位");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordNotice("两次输入的密码不一致");
      return;
    }

    setPasswordBusy(true);
    setPasswordNotice("");
    const error = await updatePetPassword(nextPassword);
    setPasswordBusy(false);
    if (error) {
      setPasswordNotice(error);
      return;
    }
    setNextPassword("");
    setConfirmPassword("");
    setPasswordNotice("密码修改成功，请妥善保存新密码");
  }

  return (
    <section className="pet-page">
      <div className="pet-profile-heading">
        <PageHeading eyebrow={user.role === "admin" ? "管理员账号" : "学习账号"} title={user.username} description="当前账号的学习记录独立保存在这台设备。" />
        <button type="button" onClick={onLogout}><LogOut aria-hidden="true" />退出登录</button>
      </div>
      <div className="pet-stats-grid">
        <div><strong>{Object.keys(progress.ratings).length}</strong><span>已接触单词</span></div>
        <div><strong>{knownCount}</strong><span>已掌握</span></div>
        <div><strong>{reviewCount}</strong><span>待巩固</span></div>
        <div><strong>{progress.streak}</strong><span>连续学习天数</span></div>
      </div>
      <section className="pet-profile-section">
        <div className="pet-panel-title"><span><ShieldCheck aria-hidden="true" /></span><div><h2>安全登录与隐私</h2><p>Supabase 负责账号验证。数据库配置完成后，学习进度与语音设置会自动同步。</p></div></div>
        <p>离线时继续保存在本机，联网后重试同步。同步状态以上方提示为准。</p>
      </section>
      <section className="pet-profile-section">
        <h2>修改登录密码</h2>
        <p>第一次登录后请立即设置一个只有自己知道的新密码，至少 8 位。</p>
        <form className="pet-password-update" onSubmit={changePassword}>
          <label htmlFor="pet-new-password">新密码</label>
          <input id="pet-new-password" type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" />
          <label htmlFor="pet-confirm-password">再次输入</label>
          <input id="pet-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          <button type="submit" disabled={passwordBusy}>{passwordBusy ? "正在修改..." : "保存新密码"}</button>
          {passwordNotice ? <p className="pet-password-update__notice" role="status">{passwordNotice}</p> : null}
        </form>
      </section>
      {user.role === "admin" ? (
        <section className="pet-profile-section">
          <div className="pet-panel-title"><span><Users aria-hidden="true" /></span><div><h2>本机用户概览</h2><p>只统计曾在当前浏览器登录并学习的账号。</p></div></div>
          <div className="pet-user-list">
            {PET_USERS.map((account) => {
              const accountProgress = loadProgress(account.username);
              return <div key={account.username}><strong>{account.username}</strong><span>{account.role === "admin" ? "管理员" : "普通用户"}</span><small>{Object.keys(accountProgress.ratings).length} 个已学习词</small></div>;
            })}
          </div>
        </section>
      ) : null}
      <section className="pet-profile-section">
        <h2>备份与恢复</h2>
        <p>此处备份词汇与学习计划。写作原稿、照片和点评请在“写作”页单独导出备份；清除浏览器数据前请分别保存。</p>
        <div className="pet-profile-actions">
          <button type="button" onClick={exportProgress}><Download aria-hidden="true" />导出 JSON 备份</button>
          <button type="button" onClick={() => importRef.current?.click()}><Upload aria-hidden="true" />恢复备份</button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={(event) => restoreProgress(event.target.files?.[0])} />
        </div>
      </section>
    </section>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }): JSX.Element {
  return <div className="pet-page-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
