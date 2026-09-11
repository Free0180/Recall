import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getBritishVoice, normalizeSpeechText, setSpeechPreferences, speak, SPEECH_FEEDBACK_EVENT, stopSpeech } from "./pet-speech";

let voices: SpeechSynthesisVoice[];
let spoken: SpeechSynthesisUtterance[];
let engine: EventTarget & { paused: boolean; resume: () => void };
const voice = (lang: string, localService = true): SpeechSynthesisVoice => ({ lang, localService } as SpeechSynthesisVoice);

beforeEach(() => {
  vi.useFakeTimers();
  setSpeechPreferences({ voiceURI: "", mode: "auto" });
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

it("prefers British English and sets the actual language", () => {
  voices = [voice("zh-CN"), voice("en-US"), voice("en-GB", false)];
  expect(getBritishVoice()).toBe(voices[2]);
  speak("ability");
  expect(spoken[0].lang).toBe("en-GB");
  expect(spoken[0].voice).toBe(voices[2]);
  expect(spoken[0].volume).toBe(1);
  voices.push(voice("en_GB"));
  expect(getBritishVoice()).toBe(voices[3]);
});

it("honors a saved voice and falls back when it is absent on another device", () => {
  voices = [{ ...voice("en-US"), voiceURI: "us" }, { ...voice("en-GB"), voiceURI: "uk" }];
  setSpeechPreferences({ voiceURI: "us", mode: "system" });
  expect(getBritishVoice()).toBe(voices[0]);
  setSpeechPreferences({ voiceURI: "missing", mode: "system" });
  expect(getBritishVoice()).toBe(voices[1]);
});

it("cleans PDF wrapping and avoids canceling between finished sentences", () => {
  expect(normalizeSpeechText("An inter-\nnational  club.\n Next\t sentence.")).toBe("An international club. Next sentence.");
  speak("First sentence.");
  spoken[0].onend?.({} as SpeechSynthesisEvent);
  speak("Second sentence.");
  expect((engine as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel).not.toHaveBeenCalled();
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
