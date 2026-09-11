export interface SpeechSettings { voiceURI: string; mode: "auto" | "system" | "recorded" }
export const DEFAULT_SPEECH: SpeechSettings = { voiceURI: "", mode: "auto" };
export function readSpeechSettings(value: unknown): SpeechSettings {
  const settings = value as Partial<SpeechSettings> | null;
  return { voiceURI: typeof settings?.voiceURI === "string" ? settings.voiceURI : "", mode: settings?.mode === "system" || settings?.mode === "recorded" ? settings.mode : "auto" };
}
