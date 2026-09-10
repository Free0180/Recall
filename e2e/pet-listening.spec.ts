import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";

const qaDir = process.env.PET_QA_DIR ?? path.join(tmpdir(), "pet-vocab-qa");
mkdirSync(qaDir, { recursive: true });

async function openListening(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("用户名").fill("RUN4");
  await page.locator("#pet-password").fill("e2e-test-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("button", { name: "精读", exact: true }).click();
  await page.getByRole("tab", { name: /听力精读/ }).click();
}

test("downloads and parses actual sample PDFs, switches matching audio, and restores the chosen resource", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openListening(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载并导入原文 PDF" }).click();
  expect((await download).suggestedFilename()).toContain("697390");
  await expect(page.locator(".pet-reading-card")).toContainText("barbecue");
  await expect(page.locator("audio")).toHaveAttribute("src", /709695/);
  await page.getByRole("button", { name: "1.25x", exact: true }).click();
  expect(await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.25);
  await page.getByLabel("选择听力资料").selectOption("general-sample-1");
  await expect(page.locator(".pet-reading-card")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveAttribute("src", /505234/);
  const secondDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载并导入原文 PDF" }).click();
  expect((await secondDownload).suggestedFilename()).toContain("697386");
  await expect(page.locator(".pet-reading-card")).toContainText("shopping trip");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(qaDir, "listening-resource-tablet.png"), fullPage: false, animations: "disabled" });
  await page.reload();
  await page.getByRole("button", { name: "精读", exact: true }).click();
  await page.getByRole("tab", { name: /听力精读/ }).click();
  await expect(page.getByLabel("选择听力资料")).toHaveValue("general-sample-1");
  await expect(page.locator(".pet-reading-card")).toContainText("shopping trip");
  await expect(page.locator("audio")).toHaveAttribute("src", /505234/);
  await page.getByLabel("选择听力资料").selectOption("schools-sample-1");
  await expect(page.locator(".pet-reading-card")).toContainText("barbecue");
  await expect(page.locator("audio")).toHaveAttribute("src", /709695/);
  await page.setViewportSize({ width: 430, height: 932 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(qaDir, "listening-resource-mobile.png"), fullPage: false, animations: "disabled" });
  expect(errors).toEqual([]);
});

test("PDF fetch failures remain recoverable and personal transcripts do not get an unrelated official audio", async ({ page }) => {
  await openListening(page);
  await page.route("**/listening/*.pdf", (route) => route.fulfill({ status: 404 }));
  await page.getByRole("button", { name: "下载并导入原文 PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("原文下载失败");
  await expect(page.getByRole("button", { name: "下载并导入原文 PDF" })).toBeEnabled();
  await page.locator('.pet-import-row input[type="file"]').first().setInputFiles({ name: "my-transcript.txt", mimeType: "text/plain", buffer: Buffer.from("This is a different recording. We need the matching audio file.") });
  await expect(page.locator(".pet-reading-card")).toContainText("This is a different recording.");
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.getByText("请导入与这份原文对应的音频", { exact: true })).toBeVisible();
  await page.getByLabel("选择听力资料").selectOption("general-sample-1");
  await expect(page.locator("audio")).toHaveAttribute("src", /505234/);
});
