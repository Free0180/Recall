import { useEffect, useState } from "react";
import { speak, stopSpeech } from "./pet-speech";
import { OfflineAudio } from "./offline-audio";
import type { SpeechSettings } from "./speech-preferences";

export function SpeechSettingsPanel({ value, onChange }: { value: SpeechSettings; onChange: (value: SpeechSettings) => void }): JSX.Element {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const engine = window.speechSynthesis;
    const refresh = (): void => setVoices(engine?.getVoices().filter(voice => /^en[-_]/i.test(voice.lang)) ?? []);
    refresh();
    engine?.addEventListener("voiceschanged", refresh);
    return () => { engine?.removeEventListener("voiceschanged", refresh); };
  }, []);
  return <section className="pet-profile-section">
    <h2>朗读与音频</h2>
    <p>系统语音优先英式英语。内置兼容音频为美式合成语音，包含词库、核心例句和音节，首次播放需要网络。</p>
    <div className="pet-password-update">
      <label htmlFor="pet-speech-mode">发音方式</label>
      <select id="pet-speech-mode" value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value as SpeechSettings["mode"] })}>
        <option value="auto">自动（华为优先兼容音频）</option>
        <option value="system">优先系统语音</option>
        <option value="recorded">优先兼容音频（美式）</option>
      </select>
      <label htmlFor="pet-speech-voice">英语声音</label>
      <select id="pet-speech-voice" value={value.voiceURI} onChange={event => onChange({ ...value, voiceURI: event.target.value })}>
        <option value="">自动选择英式英语</option>
        {value.voiceURI && !voices.some(voice => voice.voiceURI === value.voiceURI) ? <option value={value.voiceURI}>所选声音在本机不可用，暂用自动选择</option> : null}
        {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang}){voice.localService ? " · 本机" : " · 在线"}</option>)}
      </select>
      {!voices.length ? <p>未检测到英语系统语音。词库仍可使用兼容音频，动态文章需要设备安装英语语音。</p> : null}
      <button type="button" onClick={() => speak("I enjoy learning English every day.", 1, { systemOnly: true })}>试听系统声音</button>
      <button type="button" onClick={() => speak("ability", 1, { preferAudio: true })}>试听兼容音频</button>
      <button type="button" onClick={stopSpeech}>停止试听</button>
    </div>
    <OfflineAudio />
  </section>;
}
