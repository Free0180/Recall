import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ensureSchedule, updateStudyDay } from "../src/pet/study-cycle";
import { PET_STUDY_WORDS } from "../src/pet/pet-words";

const qaDir = process.env.PET_QA_DIR ?? path.join(tmpdir(), "pet-vocab-qa");
mkdirSync(qaDir, { recursive: true });

test("unresolved vocabulary returns in later cycles until mastered", async ({ page }) => {
  await start(page);
  let schedule = ensureSchedule(null, {}, "2026-09-09", { 1: "unknown", 2: "unknown" });
  schedule = updateStudyDay(schedule, 1, 0, day => ({ ...day, ratings: { 1: "again", 2: "learning" } }));
  await page.evaluate(value => localStorage.setItem("pet-vocab-progress-v2-RUN1", JSON.stringify(value)), {
    schedule, ratings: { 1: "again", 2: "learning" }, vocabulary: { 1: "unknown", 2: "unknown" }, reviews: [],
  });
  await page.clock.setFixedTime(new Date("2026-09-21T12:00:00+08:00"));
  await page.reload();
  await login(page);
  await expect(page.getByRole("heading", { name: "第 6 天 · 巩固复习" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ability", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^认识/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "今日单词已完成" })).toBeVisible();
  // Skip day seven: achieve remains unresolved and returns next cycle.
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00+08:00"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "achieve", exact: true })).toBeVisible();
  await expect(page.locator(".pet-cycle-days li").nth(5)).toContainText("1 词");
  await expect(page.locator(".pet-cycle-days li").nth(6)).toContainText("0 词");
  await page.getByRole("button", { name: /^认识/ }).click();
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+08:00"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "今天没有待复习词" })).toBeVisible();
});

async function login(page: Page, username = "RUN1"): Promise<void> {
  await page.getByLabel("用户名").fill(username);
  await page.locator("#pet-password").fill("e2e-test-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "打开用户中心" })).toContainText(username);
}

async function start(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date("2026-09-09T12:00:00+08:00"));
  await page.goto("/");
  await page.evaluate((ids) => {
    localStorage.clear();
    const progress = { vocabulary: Object.fromEntries(ids.map(id => [id, "unknown"])), ratings: {}, reviews: [] };
    localStorage.setItem("pet-vocab-progress-v2-RUN1", JSON.stringify(progress));
  }, PET_STUDY_WORDS.map(word => word.id));
  await page.reload();
}

test("daily completion unlocks dictation and offline article; both survive reload and account switching", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  let requests = 0;
  await page.route("**/__pet_test_article", async (route) => {
    requests++;
    await route.abort();
  });
  await start(page);
  await login(page);
  await expect(page).toHaveTitle("PET词汇精读");
  await expect(page.getByRole("heading", { name: "第 1 天 · 学习新词" })).toBeVisible();
  await expect(page.getByText("完成当天全部单词后解锁听写。")).toBeVisible();
  await expect(page.locator(".pet-cycle-days li").nth(5)).toContainText("待定");
  await page.screenshot({ path: path.join(qaDir, "weekly-tablet-start.png"), fullPage: true });
  for (let index = 0; index < 9; index++) await page.getByRole("button", { name: /有点熟/ }).click();
  expect(requests).toBe(0);
  await expect(page.getByRole("button", { name: "播放听写单词" })).toHaveCount(0);
  await page.getByRole("button", { name: /有点熟/ }).click();
  await expect(page.getByRole("heading", { name: "今日单词已完成" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /A Saturday to Remember|Small Jobs, Big Smiles|A Day at the Community Centre/ })).toBeVisible();
  expect(requests).toBe(0);
  const shortText = await page.locator('.pet-generated-article > div[lang="en-GB"]').innerText();
  expect(shortText.match(/[a-z]+(?:['’-][a-z]+)*/gi)!.length).toBeLessThanOrEqual(140);
  await page.evaluate(() => {
    const key = "pet-vocab-progress-v2-RUN1";
    const progress = JSON.parse(localStorage.getItem(key)!);
    const article = progress.schedule.cycles[0].days[0].article;
    delete article.offlineVersion;
    article.paragraphs = article.paragraphs.map((paragraph: string) => paragraph + " This is an old long version.".repeat(10));
    localStorage.setItem(key, JSON.stringify(progress));
  });
  await page.reload();
  await expect(page.locator('.pet-generated-article > div[lang="en-GB"]')).toHaveText(shortText, { useInnerText: true });
  await expect(page.getByText("三步背诵：", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "播放听写单词" }).click();
  await page.getByLabel("英文拼写").fill("abilty");
  await page.getByRole("button", { name: "检查拼写" }).click();
  await expect(page.getByText("拼写还不正确，再听一次。")).toBeVisible();
  for (let index = 0; index < 10; index++) {
    await page.getByLabel("英文拼写").fill(` ${PET_STUDY_WORDS[index].word.toUpperCase()} `);
    await page.getByRole("button", { name: "检查拼写" }).click();
    if (index < 9) await page.getByRole("button", { name: "下一词", exact: true }).click();
  }
  await expect(page.getByText("今日听写已完成", { exact: true })).toBeVisible();
  await page.getByText("目标词与语法讲解", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "第一条件句" })).toBeVisible();
  await page.screenshot({ path: path.join(qaDir, "weekly-tablet-complete.png"), fullPage: true });
  await page.reload();
  await expect(page.getByText("今日听写已完成", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /A Saturday to Remember|Small Jobs, Big Smiles|A Day at the Community Centre/ })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "RUN2");
  await expect(page.getByRole("heading", { name: "今天没有新词任务", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /A Saturday to Remember|Small Jobs, Big Smiles|A Day at the Community Centre/ })).toHaveCount(0);
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "RUN1");
  await expect(page.getByText("今日听写已完成", { exact: true })).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mobile review days use distinct dynamic batches and midnight switches without a reload", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await start(page);
  let schedule = ensureSchedule(null, {}, "2026-09-09");
  const ids = schedule.cycles[0].days[0].wordIds;
  const ratings = { [ids[0]]: "learning" as const, [ids[1]]: "again" as const, [ids[2]]: "known" as const, [ids[3]]: "learning" as const };
  schedule = updateStudyDay(schedule, 1, 0, (day) => ({ ...day, ratings }));
  await page.evaluate((progress) => localStorage.setItem("pet-vocab-progress-v2-RUN1", JSON.stringify(progress)), { activeIndex: 0, ratings, reviews: [], streak: 1, lastStudyDate: "2026-09-09", schedule });
  await page.clock.setFixedTime(new Date("2026-09-14T12:00:00+08:00"));
  await page.reload();
  await login(page);
  await expect(page.getByRole("heading", { name: "第 6 天 · 巩固复习" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "achieve", exact: true })).toBeVisible();
  await expect(page.locator(".pet-cycle-days li").nth(5)).toContainText("2 词");
  await expect(page.locator(".pet-cycle-days li").nth(6)).toContainText("1 词");
  await page.getByRole("button", { name: /^认识/ }).click();
  await expect(page.getByRole("heading", { name: "ability", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(qaDir, "weekly-mobile-review.png"), fullPage: true });
  await page.clock.setFixedTime(new Date("2026-09-15T00:01:00+08:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "第 7 天 · 巩固复习" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "improve", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: path.join(qaDir, "weekly-mobile-day-seven.png"), fullPage: true });
});

test("offline article supports playback speeds and keeps a saved personal word target", async ({ page }) => {
  await start(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: { cancel() {}, getVoices: () => [], speak(utterance: SpeechSynthesisUtterance) { window.sessionStorage.setItem("last-spoken-rate", String(utterance.rate)); } } });
  });
  await page.reload();
  await login(page);
  await expect(page.getByLabel("下周期每日新词数")).toHaveValue("10");
  await page.getByLabel("下周期每日新词数").selectOption("15");
  for (let index = 0; index < 10; index++) await page.getByRole("button", { name: /^认识/ }).click();
  await page.getByRole("group", { name: "文章播放速度" }).getByRole("button", { name: "1.5x", exact: true }).click();
  await page.getByRole("button", { name: "朗读今日文章", exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("last-spoken-rate"))).toBe("1.5");
  await page.getByRole("group", { name: "文章播放速度" }).getByRole("button", { name: "2x", exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("last-spoken-rate"))).toBe("2");
  await page.getByRole("button", { name: "停止播放", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("下周期每日新词数")).toHaveValue("15");
  await expect(page.getByText("离线原创组文", { exact: false })).toBeVisible();
});
