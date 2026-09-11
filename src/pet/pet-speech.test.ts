import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getBritishVoice, speak, SPEECH_FEEDBACK_EVENT, stopSpeech } from "./pet-speech";

let voices: SpeechSynthesisVoice[];
let spoken: SpeechSynthesisUtterance[];
let engine: EventTarget & { paused: boolean; resume: () => void };
const voice = (lang: string, localService = true): SpeechSynthesisVoice => ({ lang, localService } as SpeechSynthesisVoice);

beforeEach(() => {
  vi.useFakeTimers();
  voices = [];
  spoken = [];
  engine = Object.assign(new EventTarget(), {
    getVoices: () => voices, paused: false, cancel: vi.fn(), resume: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => spoken.push(utterance)),
  });
  vi.stubGlobal("speechSynthesis", engine);
  vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; constructor(text: string) { this.text = text; } });
});
afterEach(() => { stopSpeech(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("prefers local British then other local English, and sets the actual language", () => {
  voices = [voice("zh-CN"), voice("en-US"), voice("en-GB", false)];
  expect(getBritishVoice()).toBe(voices[1]);
  speak("ability");
  expect(spoken[0].lang).toBe("en-US");
  expect(spoken[0].voice).toBe(voices[1]);
  expect(spoken[0].volume).toBe(1);
  voices.push(voice("en_GB"));
  expect(getBritishVoice()).toBe(voices[3]);
});

it("starts synchronously for iOS and retries once when late voices become available", () => {
  speak("ability");
  expect(spoken).toHaveLength(1);
  voices = [voice("en-US")];
  engine.dispatchEvent(new Event("voiceschanged"));
  expect(spoken).toHaveLength(2);
  expect(spoken[1].lang).toBe("en-US");
  engine.dispatchEvent(new Event("voiceschanged"));
  expect(spoken).toHaveLength(2);
});

it("does not restart an already speaking utterance or a canceled request", () => {
  speak("ability");
  spoken[0].onstart?.({} as SpeechSynthesisEvent);
  voices = [voice("en-GB")];
  engine.dispatchEvent(new Event("voiceschanged"));
  expect(spoken).toHaveLength(1);
  stopSpeech();
  engine.dispatchEvent(new Event("voiceschanged"));
  vi.runAllTimers();
  expect(spoken).toHaveLength(1);
});

it("reports silent startup failure and releases callbacks on manual cancellation", () => {
  const error = vi.fn();
  const canceled = vi.fn();
  speak("ability", 1, { onError: error });
  vi.advanceTimersByTime(8000);
  expect(error).toHaveBeenCalledWith(expect.stringContaining("语音未能启动"));
  speak("achieve", 1, { onError: error, onCancel: canceled });
  stopSpeech();
  vi.runAllTimers();
  expect(error).toHaveBeenCalledTimes(1);
  expect(canceled).toHaveBeenCalledTimes(1);
});

it("shows engine errors to listeners and resumes a paused engine", () => {
  const messages: string[] = [];
  const receive = (event: Event): void => { messages.push((event as CustomEvent<string>).detail); };
  window.addEventListener(SPEECH_FEEDBACK_EVENT, receive);
  engine.paused = true;
  speak("ability");
  expect(engine.resume).toHaveBeenCalled();
  spoken[0].onerror?.({ error: "language-unavailable" } as SpeechSynthesisErrorEvent);
  expect(messages.at(-1)).toContain("安装英语语音数据");
  window.removeEventListener(SPEECH_FEEDBACK_EVENT, receive);
});
