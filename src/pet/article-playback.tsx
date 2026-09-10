import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { getBritishVoice } from "./pet-speech";
import { splitIntoSentences } from "./reading-documents";

export function ArticlePlayback({ text }: { text: string }): JSX.Element {
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const indexRef = useRef(0);
  const sequenceRef = useRef(0);
  const playingRef = useRef(false);
  const sentences = splitIntoSentences(text);
  useEffect(() => () => {
    sequenceRef.current++;
    if (playingRef.current) window.speechSynthesis?.cancel();
    playingRef.current = false;
  }, [text]);

  function play(index: number, rate: number): void {
    if (!("speechSynthesis" in window)) { setError("当前设备不支持语音朗读，请使用支持英语语音的浏览器。"); return; }
    const sequence = ++sequenceRef.current;
    window.speechSynthesis.cancel();
    setError("");
    setPlaying(true);
    playingRef.current = true;
    function next(position: number): void {
      if (sequence !== sequenceRef.current) return;
      if (position >= sentences.length) { setPlaying(false); playingRef.current = false; return; }
      indexRef.current = position;
      const utterance = new SpeechSynthesisUtterance(sentences[position]);
      utterance.lang = "en-GB";
      utterance.rate = rate;
      const voice = getBritishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => next(position + 1);
      utterance.onerror = (event) => {
        if (sequence !== sequenceRef.current) return;
        setPlaying(false); playingRef.current = false;
        if (event.error !== "interrupted" && event.error !== "canceled") setError("朗读失败，请检查设备的英语语音设置后重试。");
      };
      window.speechSynthesis.speak(utterance);
    }
    next(index);
  }

  return <div className="pet-article-playback">
    <div role="group" aria-label="文章播放速度" className="pet-article-speeds"><span>播放速度</span>{[0.75, 1, 1.25, 1.5, 2].map((rate) => <button type="button" key={rate} aria-pressed={speed === rate} onClick={() => { setSpeed(rate); if (playing) play(indexRef.current, rate); }}>{rate}x</button>)}</div>
    <button type="button" onClick={() => play(0, speed)}><Volume2 aria-hidden="true" />{playing ? "从头播放文章" : "朗读今日文章"}</button>
    {playing ? <button type="button" onClick={() => { sequenceRef.current++; window.speechSynthesis.cancel(); playingRef.current = false; setPlaying(false); }}>停止播放</button> : null}
    <small>播放中切换倍速将从当前句重新朗读。</small>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
