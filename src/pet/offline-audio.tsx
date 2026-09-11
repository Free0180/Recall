import { useEffect, useRef, useState } from "react";
import index from "./audio-index.json";

export function OfflineAudio(): JSX.Element {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function download(): Promise<void> {
    if (!navigator.serviceWorker?.controller || !window.caches) {
      setMessage("请在正式网站联网打开一次并刷新页面，再下载离线音频。开发预览不启用离线缓存。");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const cache = await caches.open("pet-audio-v1");
      for (const [position, file] of index.files.entries()) {
        if (abort.signal.aborted) return;
        setMessage(`正在保存音频 ${position + 1}/${index.files.length}，请保持页面打开。`);
        const url = new URL(`${import.meta.env.BASE_URL}audio/${file}`, location.origin).href;
        if (!(await cache.match(url))) {
          const response = await fetch(url, { signal: abort.signal });
          if (response.status !== 200 || !response.headers.get("content-type")?.match(/audio|octet-stream/i)) throw new Error("Audio download failed");
          await cache.put(url, response);
        }
      }
      setMessage("兼容音频已保存，可离线播放词库、核心例句和音节。浏览器清理存储后需重新下载。");
    } catch { if (!abort.signal.aborted) setMessage("下载未完成，请检查网络和设备空间后重试；已保存的部分会保留。"); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <div className="pet-profile-actions">
    <button type="button" disabled={busy} onClick={() => void download()}>{busy ? "正在保存..." : "下载离线兼容音频（美式）"}</button>
    <p>下载约 72 MB，建议使用 Wi-Fi。无需购买语音服务；动态文章仍使用系统语音。</p>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
