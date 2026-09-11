import { playRecordedSpeech, stopRecordedSpeech } from "./recorded-speech";
import type { SpeechSettings } from "./speech-preferences";

let preferences: SpeechSettings = { voiceURI: "", mode: "auto" };
export function setSpeechPreferences(value: SpeechSettings): void { preferences = value; }

export function normalizeSpeechText(text: string): string {
  return text.replace(/\u00ad/g, "").replace(/([a-z])-\s*\n\s*([a-z])/gi, "$1$2").replace(/\s+/g, " ").trim();
}

export const SPEECH_FEEDBACK_EVENT = "pet-speech-feedback";
const ENGINE_HELP = "请在安卓设置中搜索“文字转语音”或“TTS”，启用语音引擎并安装英语语音数据，再返回重试。也可换用支持系统语音的浏览器。";
let active: { utterance: SpeechSynthesisUtterance; dispose: () => void } | null = null;

function feedback(message: string): void {
  window.dispatchEvent(new CustomEvent(SPEECH_FEEDBACK_EVENT, { detail: message }));
}

export function getBritishVoice(): SpeechSynthesisVoice | undefined {
  const english = window.speechSynthesis?.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)) ?? [];
  const british = (voice: SpeechSynthesisVoice): boolean => /^en[-_]gb/i.test(voice.lang);
  return (preferences.voiceURI ? english.find(voice => voice.voiceURI === preferences.voiceURI) : undefined)
    ?? english.find(voice => british(voice) && voice.localService)
    ?? english.find(british) ?? english.find(voice => voice.localService) ?? english[0];
}

export function stopSpeech(): void {
  stopRecordedSpeech();
  const previous = active;
  active = null;
  previous?.dispose();
  if (previous || window.speechSynthesis?.speaking || window.speechSynthesis?.pending) window.speechSynthesis?.cancel();
}

export interface SpeechOptions {
  preferAudio?: boolean;
  systemOnly?: boolean;
  onEnd?: () => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
}

export function speak(text: string, rate = 0.82, options: SpeechOptions = {}): void {
  text = normalizeSpeechText(text);
  stopSpeech();
  feedback("");
  const fail = (message: string): void => { feedback(message); options.onError?.(message); };
  if (!options.systemOnly && (options.preferAudio || preferences.mode === "recorded" || (preferences.mode === "auto" && /HuaweiBrowser|HUAWEI|HarmonyOS/i.test(navigator.userAgent)) || !window.speechSynthesis)) {
    if (playRecordedSpeech(text, rate, { ...options, onError: fail })) return;
  }
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    fail("当前浏览器不支持系统语音朗读。" + ENGINE_HELP);
    return;
  }
  const engine = window.speechSynthesis;
  let utterance = new SpeechSynthesisUtterance(text);
  let started = false;
  let retried = false;
  let finished = false;
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = (): void => { clearTimeout(timer); engine.removeEventListener?.("voiceschanged", voicesChanged); utterance.onend = null; utterance.onerror = null; utterance.onstart = null; };
  const finish = (): void => { finished = true; cleanup(); active = null; };
  const error = (message: string): void => { if (finished) return; finish(); engine.cancel(); fail(message); };
  function voicesChanged(): void {
    if (started || retried || finished || !getBritishVoice()) return;
    retried = true;
    cleanup();
    engine.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    launch();
  }
  function launch(): void {
    const voice = getBritishVoice();
    utterance.lang = voice?.lang.replace("_", "-") ?? "en-GB";
    utterance.rate = rate;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
    active = { utterance, dispose: () => { finished = true; cleanup(); options.onCancel?.(); } };
    utterance.onstart = () => { started = true; clearTimeout(timer); engine.removeEventListener?.("voiceschanged", voicesChanged); };
    utterance.onend = () => { if (!finished) { finish(); options.onEnd?.(); } };
    utterance.onerror = event => {
      if (finished) return;
      if (event.error === "canceled" || event.error === "interrupted") { finish(); options.onCancel?.(); return; }
      error(event.error === "not-allowed" ? "浏览器阻止了声音播放，请允许网站播放声音，再点击播放。" : "英语朗读失败。" + ENGINE_HELP);
    };
    // Keep the utterance alive and detect engines that silently fail to start.
    timer = setTimeout(() => error("语音未能启动。请检查媒体音量、蓝牙输出及英语语音设置。" + ENGINE_HELP), 8000);
    engine.addEventListener?.("voiceschanged", voicesChanged);
    try { if (engine.paused) engine.resume(); engine.speak(utterance); }
    catch { error("无法调用系统语音。" + ENGINE_HELP); }
  }
  // The first call stays in the click handler, preserving iOS user activation.
  launch();
}
