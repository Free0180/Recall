import {
  BookMarked,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileAudio,
  FileText,
  Flame,
  Gauge,
  Headphones,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Play,
  Repeat2,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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

type Tab = "study" | "library" | "reading" | "wrong" | "profile";
type Rating = "again" | "learning" | "known";

interface ReviewRecord {
  wordId: number;
  rating: Rating;
  date: string;
  at: number;
}

interface PetProgress {
  activeIndex: number;
  ratings: Record<number, Rating>;
  reviews: ReviewRecord[];
  streak: number;
  lastStudyDate: string | null;
}

interface ListeningRange {
  start: number;
  end: number;
}

const DAILY_TARGET = 10;
const B1_WORD_COUNT = 2354;
const READING_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const PET_WORD_MAP = new Map(PET_WORDS.map((word) => [word.word.toLowerCase(), word]));
const CAMBRIDGE_LISTENING_PAGE = "https://www.cambridgeenglish.org/exams-and-tests/qualifications/preliminary/preparation/?skill=grammar,listening";
const CAMBRIDGE_LISTENING_AUDIO = "https://www.cambridgeenglish.org/Images/709695-b1-preliminary-for-schools-handbook-for-teachers-listening-audio-files.mp3";
const CAMBRIDGE_LISTENING_TRANSCRIPT = "https://www.cambridgeenglish.org/Images/697390-b1-preliminary-for-schools-listening-sample-test-1-tapescript.pdf";

const EMPTY_PROGRESS: PetProgress = {
  activeIndex: 0,
  ratings: {},
  reviews: [],
  streak: 0,
  lastStudyDate: null,
};

const TABS: Array<{ id: Tab; label: string; icon: typeof Play }> = [
  { id: "study", label: "学习", icon: Play },
  { id: "library", label: "词库", icon: LibraryBig },
  { id: "reading", label: "精读", icon: BookOpen },
  { id: "wrong", label: "错词", icon: BookMarked },
  { id: "profile", label: "我的", icon: CircleUserRound },
];

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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
      activeIndex: Math.max(0, Math.min(PET_STUDY_WORDS.length - 1, parsed.activeIndex ?? 0)),
      ratings: parsed.ratings ?? {},
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      streak: Math.max(0, parsed.streak ?? 0),
      lastStudyDate: parsed.lastStudyDate ?? null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function getBritishVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("en-gb"));
}

function speak(text: string, rate = 0.82): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  const britishVoice = getBritishVoice();
  if (britishVoice) utterance.voice = britishVoice;
  window.speechSynthesis.speak(utterance);
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

function todayUniqueCount(reviews: ReviewRecord[]): number {
  const today = localDateKey();
  return new Set(reviews.filter((review) => review.date === today).map((review) => review.wordId)).size;
}

export function PetApp(): JSX.Element {
  const [currentUser, setCurrentUser] = useState<PetUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>("study");
  const [progress, setProgress] = useState<PetProgress>(EMPTY_PROGRESS);
  const [notice, setNotice] = useState<string | null>(null);
  const currentUsername = currentUser?.username ?? null;
  const currentWord = PET_STUDY_WORDS[progress.activeIndex];
  const studiedToday = todayUniqueCount(progress.reviews);

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
    setTab("study");
  }, [currentUsername]);

  useEffect(() => {
    if (currentUser) localStorage.setItem(progressStorageKey(currentUser.username), JSON.stringify(progress));
  }, [currentUser, progress]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const moveTo = useCallback((index: number) => {
    setProgress((previous) => ({
      ...previous,
      activeIndex: (index + PET_STUDY_WORDS.length) % PET_STUDY_WORDS.length,
    }));
  }, []);

  const rateWord = useCallback((rating: Rating) => {
    setProgress((previous) => {
      const today = localDateKey();
      const isNewDay = previous.lastStudyDate !== today;
      const nextStreak = isNewDay
        ? previous.lastStudyDate === previousDateKey()
          ? previous.streak + 1
          : 1
        : previous.streak;

      return {
        ...previous,
        activeIndex: (previous.activeIndex + 1) % PET_STUDY_WORDS.length,
        ratings: { ...previous.ratings, [currentWord.id]: rating },
        reviews: [
          ...previous.reviews.slice(-499),
          { wordId: currentWord.id, rating, date: today, at: Date.now() },
        ],
        streak: nextStreak,
        lastStudyDate: today,
      };
    });
    setNotice(rating === "known" ? "已掌握，继续保持" : rating === "learning" ? "已加入巩固计划" : "已加入错词本");
  }, [currentWord.id]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if ((event.target as HTMLElement).matches("input, textarea")) return;
      if (tab !== "study") return;
      if (event.key === "ArrowLeft") moveTo(progress.activeIndex - 1);
      if (event.key === "ArrowRight") moveTo(progress.activeIndex + 1);
      if (event.key === "1") rateWord("again");
      if (event.key === "2") rateWord("learning");
      if (event.key === "3") rateWord("known");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moveTo, progress.activeIndex, rateWord, tab]);

  function openWord(word: PetWord): void {
    const nextIndex = PET_STUDY_WORDS.findIndex((item) => item.id === word.id);
    moveTo(nextIndex >= 0 ? nextIndex : 0);
    setTab("study");
  }

  function handleLogin(user: PetUser): void {
    setCurrentUser(user);
  }

  function handleLogout(): void {
    window.speechSynthesis?.cancel();
    void clearPetSession().finally(() => setCurrentUser(null));
  }

  if (!authReady) return <AuthLoadingView />;
  if (!currentUser) return <LoginView onLogin={handleLogin} />;

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
            <strong>今日 {Math.min(studiedToday, DAILY_TARGET)} / {DAILY_TARGET}</strong>
            <button type="button" className="pet-user-button" onClick={() => setTab("profile")} aria-label="打开用户中心">
              {currentUser.username}
            </button>
          </div>
        </div>
      </header>

      <main className="pet-main">
        {tab === "study" && (
          <StudyView
            word={currentWord}
            index={progress.activeIndex}
            progress={progress}
            studiedToday={studiedToday}
            onMove={moveTo}
            onRate={rateWord}
          />
        )}
        {tab === "library" && <LibraryView ratings={progress.ratings} onOpenWord={openWord} />}
        {tab === "reading" && <ReadingView username={currentUser.username} onOpenWord={openWord} />}
        {tab === "wrong" && <WrongView ratings={progress.ratings} onOpenWord={openWord} />}
        {tab === "profile" && <ProfileView user={currentUser} progress={progress} onRestore={setProgress} onLogout={handleLogout} />}
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

interface StudyViewProps {
  word: PetWord;
  index: number;
  progress: PetProgress;
  studiedToday: number;
  onMove: (index: number) => void;
  onRate: (rating: Rating) => void;
}

function StudyView({ word, index, progress, studiedToday, onMove, onRate }: StudyViewProps): JSX.Element {
  const weekCount = new Set(progress.reviews.slice(-80).map((review) => review.date)).size;
  const [activeSyllable, setActiveSyllable] = useState<number | null>(null);
  const playbackSequence = useRef(0);
  const categoryPosition = PET_STUDY_WORDS.filter((item) => item.category === word.category).findIndex((item) => item.id === word.id) + 1;
  const categoryTotal = PET_STUDY_WORDS.filter((item) => item.category === word.category).length;

  useEffect(() => {
    playbackSequence.current += 1;
    setActiveSyllable(null);
    window.speechSynthesis?.cancel();
  }, [word.id]);

  function playSyllables(): void {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const sequence = playbackSequence.current + 1;
    playbackSequence.current = sequence;
    const voice = getBritishVoice();

    function playPart(partIndex: number): void {
      if (playbackSequence.current !== sequence || partIndex >= word.syllables.length) {
        setActiveSyllable(null);
        return;
      }
      setActiveSyllable(partIndex);
      const utterance = new SpeechSynthesisUtterance(word.syllables[partIndex]);
      utterance.lang = "en-GB";
      utterance.rate = 0.62;
      if (voice) utterance.voice = voice;
      utterance.onend = () => playPart(partIndex + 1);
      utterance.onerror = () => setActiveSyllable(null);
      window.speechSynthesis.speak(utterance);
    }

    playPart(0);
  }

  return (
    <div className="pet-study-grid">
      <section className="pet-word-card" aria-labelledby="active-word">
        <div className="pet-word-card__topline">
          <span>主题：{word.category} · {categoryPosition}/{categoryTotal}</span>
          <span>{index + 1} / {PET_STUDY_WORDS.length}</span>
        </div>
        <div className="pet-word-progress" role="progressbar" aria-label="词库进度" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={PET_STUDY_WORDS.length}>
          <span style={{ width: `${((index + 1) / PET_STUDY_WORDS.length) * 100}%` }} />
        </div>

        <div className="pet-word-heading">
          <div>
            <h1 id="active-word">{word.word}</h1>
            <p>{word.ipa}</p>
          </div>
          <button className="pet-speak-button" type="button" onClick={() => speak(word.word)} aria-label={`播放 ${word.word} 的英式发音`}>
            <Volume2 aria-hidden="true" />
          </button>
        </div>

        <p className="pet-meaning"><strong>{word.partOfSpeech}</strong> {word.meaning}</p>

        <div className="pet-phonics">
          <div className="pet-phonics__heading">
            <div className="pet-section-label"><Sparkles aria-hidden="true" />自然拼读</div>
            <button type="button" onClick={playSyllables} aria-label="按顺序播放音节"><Play aria-hidden="true" />播放音节</button>
          </div>
          <div className="pet-syllables" aria-label={`音节分段 ${word.syllables.join(" ")}`}>
            {word.syllables.map((part, partIndex) => <span className={activeSyllable === partIndex ? "is-active" : ""} key={`${part}-${partIndex}`}>{part}</span>)}
          </div>
          <strong>{word.stress}</strong>
          <p>{word.phonics}</p>
        </div>

        <div className="pet-example">
          <div className="pet-section-label"><BookOpen aria-hidden="true" />例句</div>
          <button type="button" onClick={() => speak(word.example)} aria-label="朗读例句">
            <span>{word.example.split(/(\b[A-Za-z]+\b)/).map((token, tokenIndex) => token.toLowerCase() === word.word.toLowerCase() ? <mark key={`${token}-${tokenIndex}`}>{token}</mark> : token)}</span><Volume2 aria-hidden="true" />
          </button>
          <p>{word.translation}</p>
        </div>

        <div className="pet-rating" aria-label="选择熟悉程度">
          <button type="button" className="pet-rating__again" onClick={() => onRate("again")}><X aria-hidden="true" /><span>不认识<small>按 1</small></span></button>
          <button type="button" className="pet-rating__learning" onClick={() => onRate("learning")}><RotateCcw aria-hidden="true" /><span>有点熟<small>按 2</small></span></button>
          <button type="button" className="pet-rating__known" onClick={() => onRate("known")}><Check aria-hidden="true" /><span>认识<small>按 3</small></span></button>
        </div>

        <div className="pet-word-pager">
          <button type="button" onClick={() => onMove(index - 1)}><ChevronLeft aria-hidden="true" />上一个</button>
          <button type="button" onClick={() => onMove(index + 1)}>下一个<ChevronRight aria-hidden="true" /></button>
        </div>
      </section>

      <aside className="pet-study-aside">
        <section className="pet-plan">
          <div className="pet-panel-title"><span><Check aria-hidden="true" /></span><div><h2>今日计划</h2><p>一点一点，稳稳进步</p></div></div>
          <PlanRow label="新学单词" value={`${Math.min(studiedToday, 10)} / 10`} progress={Math.min(studiedToday / 10, 1)} tone="blue" />
          <PlanRow label="复习单词" value={`${Math.min(Object.keys(progress.ratings).length, 8)} / 8`} progress={Math.min(Object.keys(progress.ratings).length / 8, 1)} tone="green" />
          <PlanRow label="精读训练" value="0 / 10分钟" progress={0} tone="coral" />
        </section>
        <section className="pet-streak">
          <div className="pet-panel-title"><span><Flame aria-hidden="true" /></span><div><h2>本周进度</h2><p>每次学习都算数</p></div></div>
          <div className="pet-streak__number"><strong>{progress.streak || weekCount}</strong><span>天<br />连续学习</span></div>
          <div className="pet-week" aria-label="本周学习记录">
            {["一", "二", "三", "四", "五", "六", "日"].map((day, dayIndex) => <span className={dayIndex < Math.min(weekCount, 7) ? "is-done" : ""} key={day}>{day}</span>)}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PlanRow({ label, value, progress, tone }: { label: string; value: string; progress: number; tone: string }): JSX.Element {
  return (
    <div className={`pet-plan-row pet-plan-row--${tone}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="pet-plan-row__bar"><span style={{ width: `${progress * 100}%` }} /></div>
    </div>
  );
}

function LibraryView({ ratings, onOpenWord }: { ratings: Record<number, Rating>; onOpenWord: (word: PetWord) => void }): JSX.Element {
  const [query, setQuery] = useState("");
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
    return PET_WORDS.filter((word) => !needle || word.word.includes(needle) || word.meaning.includes(needle));
  }, [query]);

  const filteredB1 = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return b1Words;
    return b1Words.filter((word) => word.word.toLowerCase().includes(needle) || word.translation_cn.includes(needle));
  }, [b1Words, query]);

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
      <div className="pet-library-summary"><strong>{lexicon === "curated" ? PET_WORDS.length : B1_WORD_COUNT}</strong><span>当前词库词量</span><small>{lexicon === "curated" ? "可进入分类学习" : "输入英文或中文快速检索"}</small></div>
      <label className="pet-search"><Search aria-hidden="true" /><span className="sr-only">搜索单词</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文释义" /></label>
      {loading ? <div className="pet-loading"><LoaderCircle aria-hidden="true" />正在加载 2354 个词条…</div> : null}
      {loadError ? <p className="pet-inline-error" role="alert">{loadError}</p> : null}
      <div className="pet-library-list">
        {lexicon === "curated" ? filteredCurated.map((word) => {
          const rating = ratings[word.id];
          return (
            <button type="button" key={word.id} onClick={() => onOpenWord(word)}>
              <span className={`pet-word-status pet-word-status--${rating ?? "new"}`} aria-hidden="true" />
              <span><strong>{word.word}</strong><small>{word.ipa} · {word.category}</small></span>
              <span>{word.partOfSpeech} {word.meaning}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          );
        }) : filteredB1.slice(0, 100).map((word) => (
          <button type="button" key={`${word.word}-${word.part_of_speech}`} onClick={() => speak(word.word)} aria-label={`朗读 ${word.word}`}>
            <span className="pet-word-status pet-word-status--new" aria-hidden="true" />
            <span><strong>{word.word}</strong><small>{word.phonetic} · {word.cefr_level}</small></span>
            <span>{word.part_of_speech} {word.translation_cn}</span>
            <Volume2 aria-hidden="true" />
          </button>
        ))}
      </div>
      {lexicon === "b1" && filteredB1.length > 100 ? <p className="pet-library-note">共找到 {filteredB1.length} 个词，当前显示前 100 个。继续输入可缩小范围。</p> : null}
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

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    window.speechSynthesis?.cancel();
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [audioUrl, speed]);

  useEffect(() => {
    setActiveDocument(null);
    setSelectedWord(null);
    setActiveSentenceIndex(null);
    setDictationIndex(null);
    setDictationAnswer("");
    setDictationResult(null);
    if (mode === "reading") audioRef.current?.pause();
  }, [mode]);

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
    setProcessing(true);
    setImportError("");
    try {
      const document = await parseReadingFile(file, mode);
      setDocuments(saveReadingDocument(username, document));
      setActiveDocument(document);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "文件读取失败");
    } finally {
      setProcessing(false);
    }
  }

  function importAudio(file: File | undefined): void {
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
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
        <button type="button" role="tab" aria-selected={mode === "reading"} className={mode === "reading" ? "is-active" : ""} onClick={() => setMode("reading")}><BookOpen aria-hidden="true" /><span><strong>阅读精读</strong><small>文章 · 生词 · 逐句理解</small></span></button>
        <button type="button" role="tab" aria-selected={mode === "listening"} className={mode === "listening" ? "is-active" : ""} onClick={() => setMode("listening")}><Headphones aria-hidden="true" /><span><strong>听力精读</strong><small>原版音频 · 原文 · 倍速</small></span></button>
      </div>
      <PageHeading
        eyebrow={isListening ? "PET 原版听力精练" : "PET 难度阅读精练"}
        title={isListening ? "听力精读" : "阅读精读"}
        description={isListening ? "使用 Cambridge 官网当前公开样题，或导入自己的音频与听力原文。" : "导入 TXT、Word 或 PDF 文章，逐句理解并积累重点词汇。"}
      />

      {isListening ? (
        <section className="pet-official-resource" aria-label="Cambridge 官方听力资料">
          <div className="pet-official-resource__meta"><span>官网当前公开版本</span><strong>2026-09 已核对</strong></div>
          <div className="pet-official-resource__heading"><div><small>Cambridge English</small><h2>B1 Preliminary for Schools · Listening Sample Test 1</h2><p>音频直接来自 Cambridge 官网，不复制进应用。听力原文可从官网下载后导入，便于逐句精读。</p></div><ShieldCheck aria-hidden="true" /></div>
          <div className="pet-official-resource__links">
            <a href={CAMBRIDGE_LISTENING_PAGE} target="_blank" rel="noreferrer">官方备考页<ExternalLink aria-hidden="true" /></a>
            <a href={CAMBRIDGE_LISTENING_TRANSCRIPT} target="_blank" rel="noreferrer">下载听力原文 PDF<Download aria-hidden="true" /></a>
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
                <button type="button" onClick={() => setActiveDocument(document)} aria-label={`打开已保存文档 ${document.title}`}><strong>{document.title}</strong><small>{document.sourceType.toUpperCase()}</small></button>
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

      {isListening ? <div className="pet-audio pet-audio--official"><Headphones aria-hidden="true" /><div><strong>{audioName || "Cambridge 官方样题听力音频"}</strong><small>{audioUrl ? "本地导入 · 仅本次会话" : "在线播放 · 来源 Cambridge English 官网"}</small><audio ref={audioRef} controls preload="metadata" src={audioUrl ?? CAMBRIDGE_LISTENING_AUDIO} onTimeUpdate={handleAudioTimeUpdate}>浏览器不支持音频播放。</audio></div></div> : null}

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
          <div><h2>导入原文后开始逐句精听</h2><p>先播放上方官方音频做一遍盲听，再下载官方听力原文 PDF 并导入。系统会自动拆分句子、标出生词，并保存在当前账号。</p></div>
          <a href={CAMBRIDGE_LISTENING_TRANSCRIPT} target="_blank" rel="noreferrer">下载官方原文<Download aria-hidden="true" /></a>
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

function WrongView({ ratings, onOpenWord }: { ratings: Record<number, Rating>; onOpenWord: (word: PetWord) => void }): JSX.Element {
  const words = PET_WORDS.filter((word) => ratings[word.id] === "again" || ratings[word.id] === "learning");
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
        onRestore({ ...EMPTY_PROGRESS, ...next });
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
        <div className="pet-panel-title"><span><ShieldCheck aria-hidden="true" /></span><div><h2>安全登录与隐私</h2><p>Supabase 只负责账号验证，学习记录仍保存在当前设备。</p></div></div>
        <p>安装到手机或平板桌面后，可以像普通 App 一样打开。不同设备上的学习进度目前不会自动同步。</p>
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
        <p>清除浏览器数据前，建议先导出学习记录。</p>
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
