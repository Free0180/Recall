import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const qaDir = process.env.PET_QA_DIR ?? path.join(tmpdir(), "pet-vocab-qa");
mkdirSync(qaDir, { recursive: true });

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function login(page: Page, username = "RUN1"): Promise<void> {
  await page.getByLabel("用户名").fill(username);
  await page.locator("#pet-password").fill("e2e-test-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "打开用户中心" })).toContainText(username);
  if (username === "RUN1") {
    await page.getByRole("button", { name: "词库", exact: true }).click();
    for (const word of ["ability", "achieve"]) await page.getByRole("button", { name: `不认识 ${word}`, exact: true }).click();
    await page.getByRole("button", { name: "增加", exact: true }).click();
  }
}

test("tablet learning flow, wrong words, library and reading", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page).toHaveTitle("PET词汇精读");
  await expect(page.getByRole("heading", { name: "登录后开始学习" })).toBeVisible();
  await login(page);
  await expect(page.getByRole("heading", { name: "ability" })).toBeVisible();
  await expect(page.getByText("自然拼读", { exact: true })).toBeVisible();
  await expect(page.getByText("主题：学习与能力", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "按顺序播放音节" })).toBeVisible();
  await expect(page.locator(".pet-example mark")).toHaveText("ability");
  await expect(page.getByText("She has the ability to learn quickly.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: path.join(qaDir, "pet-tablet-study-1440x900.png"), fullPage: false });

  await page.getByRole("button", { name: /不认识/ }).click();
  await expect(page.getByRole("heading", { name: "achieve" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("已加入错词本");

  await page.getByRole("button", { name: "错词" }).click();
  await expect(page.getByRole("heading", { name: "错词本" })).toBeVisible();
  await expect(page.getByText("ability", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "词库" }).click();
  await page.getByPlaceholder("搜索英文或中文释义").fill("环境");
  await expect(page.getByText("environment", { exact: true })).toBeVisible();
  await expect(page.getByText("ability", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: /PET\/B1 扩展词库/ }).click();
  await expect(page.locator(".pet-library-summary strong")).toBeVisible();
  await page.getByPlaceholder("搜索英文或中文释义").fill("abandon");
  await expect(page.getByText("abandon", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "精读" }).click();
  await expect(page.getByRole("heading", { name: "A Different Kind of School Trip" })).toBeVisible();
  await page.getByRole("button", { name: "1.25x" }).click();
  await expect(page.getByRole("button", { name: "1.25x" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "播放第 1 句" })).toBeVisible();
  await page.locator('.pet-import-row input[type="file"]').first().setInputFiles({
    name: "pet-reading-practice.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Ability helps us learn. Practice gives everyone an opportunity to improve."),
  });
  await expect(page.getByRole("heading", { name: "pet-reading-practice" })).toBeVisible();
  await expect(page.locator(".pet-saved-readings__list button").first()).toContainText("pet-reading-practice");
  await page.getByRole("button", { name: "opportunity", exact: true }).click();
  await expect(page.locator(".pet-reading-word")).toContainText("机会");

  await page.screenshot({ path: path.join(qaDir, "pet-tablet-1440x900.png"), fullPage: true });
  expect(runtimeErrors).toEqual([]);
});

test("mobile first viewport keeps the complete study controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.screenshot({ path: path.join(qaDir, "pet-login-430x932.png"), fullPage: false });
  await login(page);
  await expect(page.getByRole("heading", { name: "ability" })).toBeVisible();
  await expect(page.getByRole("button", { name: /不认识/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /有点熟/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^认识/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主要导航" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: path.join(qaDir, "pet-mobile-study-430x932.png"), fullPage: false });

  await page.getByRole("button", { name: /有点熟/ }).click();
  await expect(page.getByRole("heading", { name: "achieve" })).toBeVisible();
  await page.screenshot({ path: path.join(qaDir, "pet-mobile-430x932.png"), fullPage: false });
  expect(runtimeErrors).toEqual([]);
});

test("admin can see the fixed account overview and log out", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await login(page, "FREE1");
  await page.getByRole("button", { name: "我的" }).click();
  await expect(page.getByRole("heading", { name: "FREE1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "本机用户概览" })).toBeVisible();
  await expect(page.getByText("RUN10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("heading", { name: "登录后开始学习" })).toBeVisible();
});

test("DOCX and PDF files are parsed locally for intensive reading", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await login(page, "RUN2");
  await page.getByRole("button", { name: "精读" }).click();
  const documentInput = page.locator('.pet-import-row input[type="file"]').first();

  await documentInput.setInputFiles(path.resolve("e2e/fixtures/pet-practice.docx"));
  await expect(page.getByRole("heading", { name: "pet-practice" })).toBeVisible();
  await expect(page.getByText(/Ability and practice help students achieve their goals/)).toBeVisible();

  await documentInput.setInputFiles(path.resolve("e2e/fixtures/pet-practice.pdf"));
  await expect(page.getByRole("heading", { name: "pet-practice" })).toBeVisible();
  await expect(page.getByText(/Opportunity helps students improve their ability/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("reading and listening intensive modules keep different content", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 820 });
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await login(page, "RUN3");
  await page.getByRole("button", { name: "精读" }).click();

  await expect(page.getByRole("tab", { name: /阅读精读/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "A Different Kind of School Trip" })).toBeVisible();

  await page.getByRole("tab", { name: /听力精读/ }).click();
  await expect(page.getByRole("heading", { name: "听力精读", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "B1 Preliminary for Schools · Listening Sample Test 1", exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute("src", /cambridgeenglish\.org/);
  await expect(page.getByRole("heading", { name: "导入原文后开始逐句精听" })).toBeVisible();

  await page.locator('.pet-import-row input[type="file"]').first().setInputFiles({
    name: "official-listening-transcript.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A school reporter talks to a student. The student describes an opportunity to join a new club."),
  });
  await expect(page.getByRole("heading", { name: "official-listening-transcript" })).toBeVisible();
  await expect(page.getByText(/A school reporter talks to a student/)).toBeVisible();
  await expect(page.getByRole("button", { name: "单句循环" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "配置第 1 句时间" }).click();
  await page.getByLabel("第 1 句句首时间").fill("10");
  await page.getByLabel("第 1 句句尾时间").fill("12.5");
  await expect(page.getByRole("button", { name: "播放原音第 1 句" })).toHaveClass(/is-configured/);
  await page.getByRole("button", { name: "听写第 1 句" }).click();
  await expect(page.getByText(/A ______ reporter _____ to a student/)).toBeVisible();
  await page.getByPlaceholder("根据音频输入完整英文句子").fill("A school reporter talks to a student.");
  await page.getByRole("button", { name: "检查答案" }).click();
  await expect(page.getByRole("status")).toContainText("正确");

  await page.getByRole("tab", { name: /阅读精读/ }).click();
  await expect(page.getByRole("heading", { name: "A Different Kind of School Trip" })).toBeVisible();
  await expect(page.getByText("official-listening-transcript", { exact: true })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});
