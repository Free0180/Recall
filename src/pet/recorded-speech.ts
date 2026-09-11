import index from "./audio-index.json";

interface AudioOptions { onEnd?: () => void; onError?: (message: string) => void; onCancel?: () => void }
let cancelCurrent: (() => void) | null = null;

export function stopRecordedSpeech(): void {
  const cancel = cancelCurrent;
  cancelCurrent = null;
  cancel?.();
}

export function playRecordedSpeech(text: string, rate: number, options: AudioOptions): boolean {
  const clip = (index.clips as Record<string, number[]>)[text.trim().toLowerCase()];
  if (!clip) return false;
  const [file, start, end] = clip;
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/${index.files[file]}#t=${start},${end}`);
  audio.playbackRate = rate;
  let done = false;
  const timer = setInterval(() => { if (audio.currentTime >= end) finish(); }, 40);
  const cleanup = (): void => {
    done = true;
    clearInterval(timer); clearTimeout(watchdog);
    audio.onloadedmetadata = null; audio.onended = null; audio.onerror = null; audio.onplaying = null;
    audio.pause();
    audio.removeAttribute("src"); audio.load();
    cancelCurrent = null;
  };
  function finish(): void { if (!done) { cleanup(); options.onEnd?.(); } }
  const fail = (): void => { if (!done) { cleanup(); options.onError?.("兼容音频无法播放，请检查网络、媒体音量和浏览器声音权限，然后再点击播放。"); } };
  cancelCurrent = () => { cleanup(); options.onCancel?.(); };
  audio.onloadedmetadata = () => { try { audio.currentTime = start; } catch { fail(); } };
  audio.onplaying = () => { clearTimeout(watchdog); };
  audio.onended = finish;
  audio.onerror = fail;
  const watchdog = setTimeout(fail, 15000);
  // Call play during the user gesture; metadata seeking happens before playback.
  try { void audio.play().catch(fail); } catch { fail(); }
  return true;
}
