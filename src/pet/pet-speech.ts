export function getBritishVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("en-gb"));
}

export function speak(text: string, rate = 0.82): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  const britishVoice = getBritishVoice();
  if (britishVoice) utterance.voice = britishVoice;
  window.speechSynthesis.speak(utterance);
}
