import { BookOpen, Check, ChevronLeft, ChevronRight, Play, RotateCcw, Sparkles, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PET_STUDY_WORDS, type PetWord } from "./pet-words";
import type { Rating } from "./study-cycle";
import { speak, stopSpeech } from "./pet-speech";

interface WordStudyCardProps {
  word: PetWord;
  index: number;
  total: number;
  onMove: (index: number) => void;
  onRate: (rating: Rating) => void;
}

export function WordStudyCard({ word, index, total, onMove, onRate }: WordStudyCardProps): JSX.Element {
  const [activeSyllable, setActiveSyllable] = useState<number | null>(null);
  const playbackSequence = useRef(0);
  const categoryPosition = PET_STUDY_WORDS.filter((item) => item.category === word.category).findIndex((item) => item.id === word.id) + 1;
  const categoryTotal = PET_STUDY_WORDS.filter((item) => item.category === word.category).length;

  useEffect(() => {
    playbackSequence.current += 1;
    setActiveSyllable(null);
    stopSpeech();
    return () => { playbackSequence.current++; stopSpeech(); };
  }, [word.id]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      const target = event.target as HTMLElement;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === "ArrowLeft") onMove(index - 1);
      if (event.key === "ArrowRight") onMove(index + 1);
      if (event.key === "1") onRate("again");
      if (event.key === "2") onRate("learning");
      if (event.key === "3") onRate("known");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, onMove, onRate]);

  function playSyllables(): void {
    stopSpeech();
    const sequence = playbackSequence.current + 1;
    playbackSequence.current = sequence;

    function playPart(partIndex: number): void {
      if (playbackSequence.current !== sequence || partIndex >= word.syllables.length) {
        setActiveSyllable(null);
        return;
      }
      setActiveSyllable(partIndex);
      speak(word.syllables[partIndex], 0.62, {
        onEnd: () => playPart(partIndex + 1),
        onError: () => setActiveSyllable(null),
        onCancel: () => { playbackSequence.current++; setActiveSyllable(null); },
      });
    }

    playPart(0);
  }

  return (
      <section className="pet-word-card" aria-labelledby="active-word">
        <div className="pet-word-card__topline">
          <span>主题：{word.category} · {categoryTotal ? `${categoryPosition}/${categoryTotal}` : "B1"}</span>
          <span>{index + 1} / {total}</span>
        </div>
        <div className="pet-word-progress" role="progressbar" aria-label="当前词表进度" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>

        <div className="pet-word-heading">
          <div>
            <h1 id="active-word">{word.word}</h1>
            <p>{word.ipa}</p>
          </div>
          <button className="pet-speak-button" type="button" onClick={() => speak(word.word)} aria-label={`播放 ${word.word} 的英语发音`}>
            <Volume2 aria-hidden="true" />
          </button>
        </div>

        <p className="pet-meaning"><strong>{word.partOfSpeech}</strong> {word.meaning}</p>
        <button type="button" className="pet-compatible-audio" onClick={() => speak(word.word, 0.82, { preferAudio: true })}>兼容音频（美式）</button>

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

  );
}
