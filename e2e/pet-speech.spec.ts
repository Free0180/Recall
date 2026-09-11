import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const audioIndex = JSON.parse(readFileSync("src/pet/audio-index.json", "utf8")) as { clips: Record<string, number[]> };

test("Huawei fallback plays a real vocabulary clip without speech synthesis", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { value: "HuaweiBrowser" });
    Object.defineProperty(window, "speechSynthesis", { value: undefined });
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) { super(src); Object.defineProperty(window, "petTestAudio", { value: this, configurable: true }); }
    };
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("pet-vocab-e2e-session", "RUN1"));
  await page.reload();
  await page.getByRole("button", { name: "词库", exact: true }).click();
  await page.getByLabel("搜索单词").fill("achieve");
  await page.locator(".pet-vocabulary-open").first().click();
  await page.getByRole("button", { name: "播放 achieve 的英语发音", exact: true }).click();
  const start = audioIndex.clips.achieve[1];
  await expect.poll(() => page.evaluate(() => (window as unknown as { petTestAudio: HTMLAudioElement }).petTestAudio.currentTime)).toBeGreaterThan(start);
  await expect(page.locator(".pet-speech-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "词库", exact: true }).click();
});

test("word audio uses available English and shows a visible Android engine error", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { text: string; constructor(text: string) { this.text = text; } } });
    const engine = Object.assign(new EventTarget(), {
      getVoices: () => [{ lang: "en-US", localService: true, name: "Local English", voiceURI: "test", default: true }],
      cancel() {}, resume() {}, paused: false,
      speak(utterance: SpeechSynthesisUtterance) {
        sessionStorage.setItem("speech-language", utterance.lang);
        if (sessionStorage.getItem("fail-speech")) {
          utterance.onerror?.({ error: "language-unavailable" } as SpeechSynthesisErrorEvent);
        } else {
          utterance.onstart?.({} as SpeechSynthesisEvent);
          utterance.onend?.({} as SpeechSynthesisEvent);
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", { value: engine });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("pet-vocab-e2e-session", "RUN1"));
  await page.reload();
  await page.getByRole("button", { name: "词库", exact: true }).click();
  await page.locator(".pet-vocabulary-open").first().click();
  await page.getByRole("button", { name: "播放 ability 的英语发音", exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("speech-language"))).toBe("en-US");
  await expect(page.locator(".pet-speech-feedback")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem("fail-speech", "1"));
  await page.getByRole("button", { name: "播放 ability 的英语发音", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("安装英语语音数据");
  await page.getByRole("button", { name: "关闭提示", exact: true }).click();
  await expect(page.locator(".pet-speech-feedback")).toHaveCount(0);
});
