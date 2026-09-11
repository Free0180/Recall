import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

for (const width of [1440, 430]) {
  test(`speech preferences persist per user and local-only status is honest (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 932 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript(() => {
      Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { text: string; constructor(text: string) { this.text = text; } } });
      Object.defineProperty(window, "speechSynthesis", { value: Object.assign(new EventTarget(), {
        getVoices: () => [{ lang: "en-GB", localService: true, name: "British English", voiceURI: "british" }],
        cancel() {}, resume() {}, paused: false,
        speak(utterance: SpeechSynthesisUtterance) { sessionStorage.setItem("voice", utterance.voice?.voiceURI ?? ""); utterance.onstart?.({} as SpeechSynthesisEvent); utterance.onend?.({} as SpeechSynthesisEvent); },
      }) });
    });
    await page.goto("/");
    await expect(page).toHaveTitle("PET词汇精读");
    await page.evaluate(() => localStorage.setItem("pet-vocab-e2e-session", "RUN1"));
    await page.reload();
    await page.getByRole("button", { name: "我的", exact: true }).click();
    await expect(page.getByLabel("云同步")).toContainText("云同步尚未连接");
    await page.getByLabel("发音方式").selectOption("system");
    await page.getByLabel("英语声音").selectOption("british");
    await page.getByRole("button", { name: "试听系统声音" }).click();
    expect(await page.evaluate(() => sessionStorage.getItem("voice"))).toBe("british");
    await page.reload();
    await page.getByRole("button", { name: "我的", exact: true }).click();
    await expect(page.getByLabel("发音方式")).toHaveValue("system");
    await expect(page.getByLabel("英语声音")).toHaveValue("british");
    await page.getByRole("button", { name: "下载离线兼容音频（美式）" }).click();
    await expect(page.getByText("请在正式网站联网打开一次并刷新页面，再下载离线音频。开发预览不启用离线缓存。")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(tmpdir(), `pet-cloud-audio-${width}.png`), fullPage: false });
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.getByLabel("用户名").fill("RUN2");
    await page.locator("#pet-password").fill("e2e-test-only-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("button", { name: "我的", exact: true }).click();
    await expect(page.getByLabel("发音方式")).toHaveValue("auto");
    await expect(page.getByLabel("英语声音")).toHaveValue("");
    expect(errors).toEqual([]);
  });
}
