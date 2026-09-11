import { useEffect, useState } from "react";
import { SPEECH_FEEDBACK_EVENT } from "./pet-speech";

export function SpeechFeedback(): JSX.Element | null {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const receive = (event: Event): void => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener(SPEECH_FEEDBACK_EVENT, receive);
    window.speechSynthesis?.getVoices();
    return () => window.removeEventListener(SPEECH_FEEDBACK_EVENT, receive);
  }, []);
  return message ? <div className="pet-speech-feedback" role="alert"><strong>语音播放提示</strong><p>{message}</p><button type="button" onClick={() => setMessage("")}>关闭提示</button></div> : null;
}
