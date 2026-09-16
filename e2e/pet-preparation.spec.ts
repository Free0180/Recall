import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

for(const width of [1440,430]) {
  test(`preparation quiz, correction, manual review, backup and account isolation (${width})`,async({page})=>{
    await page.setViewportSize({width,height:932});
    const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.goto("/"); await page.evaluate(()=>localStorage.setItem("pet-vocab-e2e-session","RUN1")); await page.reload();
    await page.getByRole("button",{name:"备考",exact:true}).click();
    await expect(page).toHaveTitle(/PET/);
    await expect(page.getByRole("heading",{name:"备考中心"})).toBeVisible();
    await page.getByLabel("本周薄弱项与调整").fill("本周练习条件句和听力数字。");
    await page.getByRole("heading",{name:"备考中心"}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(tmpdir(),`pet-preparation-${width}.png`)});
    await page.getByRole("button",{name:"阅读训练 六类题型"}).click();
    await page.getByRole("button",{name:"Reading 6"}).click();
    await page.getByLabel("练习模式").selectOption("check");
    await page.getByRole("button",{name:"开始计时作答"}).click();
    await page.getByLabel("Gap 1",{exact:true}).fill("to");
    await page.getByLabel("Gap 2",{exact:true}).fill("what");
    await page.getByLabel("Gap 3",{exact:true}).fill("than");
    await page.getByRole("button",{name:"提交并查看解析"}).click();
    await expect(page.getByText("本次 2 / 3 题正确",{exact:false})).toBeVisible();
    await page.getByRole("button",{name:"全科错题 错因"}).click();
    await page.getByLabel("错因：r6a").selectOption("词汇或搭配");
    await page.getByRole("button",{name:"重新练习这一组"}).click();
    await page.getByRole("button",{name:"开始计时作答"}).click();
    await page.getByLabel("Gap 1",{exact:true}).fill("for");
    await page.getByLabel("Gap 2",{exact:true}).fill("what");
    await page.getByLabel("Gap 3",{exact:true}).fill("than");
    await page.getByRole("button",{name:"提交并查看解析"}).click();
    await page.getByRole("button",{name:"全科错题 错因"}).click();
    await expect(page.getByText("暂无待复习客观题",{exact:false})).toBeVisible();
    await page.getByRole("button",{name:"口语训练 四个环节"}).click();
    await page.getByLabel("原始表现与材料").fill("录音：part1.m4a；独立回答两分钟，有三次长停顿。");
    await page.getByLabel("手工点评（可稍后填写）").fill("下次为每个观点补充一个具体例子。");
    await page.getByRole("button",{name:"保存这条记录"}).click();
    await expect(page.getByLabel("点评与复查：Part 1" )).toHaveValue("下次为每个观点补充一个具体例子。");
    await page.getByRole("button",{name:"家长复盘 学习报告"}).click();
    await expect(page.locator(".pet-prep-report")).toContainText("累计首次作答 2/3 题");
    const download=page.waitForEvent("download"); await page.getByRole("button",{name:"导出备考备份",exact:true}).click(); const file=await download;
    await page.reload(); await page.getByRole("button",{name:"备考",exact:true}).click();
    await expect(page.getByLabel("本周薄弱项与调整")).toHaveValue("本周练习条件句和听力数字。");
    await page.getByRole("button",{name:"家长复盘 学习报告"}).click();
    page.once("dialog",d=>d.accept()); await page.getByLabel("恢复备考备份").setInputFiles((await file.path())!);
    await expect(page.getByRole("status")).toContainText("已保存到本机");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await page.getByRole("button",{name:"我的",exact:true}).click(); await page.getByRole("button",{name:"退出登录"}).click();
    await page.getByLabel("用户名").fill("RUN2"); await page.locator("#pet-password").fill("e2e-test-only-password"); await page.getByRole("button",{name:"登录",exact:true}).click();
    await page.getByRole("button",{name:"备考",exact:true}).click(); await expect(page.getByLabel("本周薄弱项与调整")).not.toHaveValue("本周练习条件句和听力数字。");
    await page.getByRole("button",{name:"家长复盘 学习报告"}).click(); await page.getByLabel("恢复备考备份").setInputFiles((await file.path())!);
    await expect(page.getByRole("status")).toContainText("不属于当前账号");
    expect(errors).toEqual([]);
  });
}

test("listening check limits playback and hides transcript until submission",async({page})=>{
  await page.addInitScript(()=>{
    class Utterance { text:string; onstart:(()=>void)|null=null; onend:(()=>void)|null=null; constructor(text:string){this.text=text;} }
    Object.defineProperty(window,"SpeechSynthesisUtterance",{value:Utterance,configurable:true});
    Object.defineProperty(window,"speechSynthesis",{value:{getVoices:()=>[],addEventListener:()=>{},removeEventListener:()=>{},cancel:()=>{},speak:(u:Utterance)=>{u.onstart?.();setTimeout(()=>u.onend?.(),50);}},configurable:true});
  });
  await page.goto("/"); await page.evaluate(()=>localStorage.setItem("pet-vocab-e2e-session","RUN1")); await page.reload();
  await page.getByRole("button",{name:"备考",exact:true}).click(); await page.getByRole("button",{name:"听力训练 四类题型"}).click(); await page.getByRole("button",{name:"Listening 1"}).click();
  await page.getByLabel("练习模式").selectOption("check"); await page.getByRole("button",{name:"开始计时作答"}).click();
  await expect(page.getByRole("button",{name:"显示原文进行精听"})).toHaveCount(0);
  await page.getByRole("button",{name:"播放听力"}).click(); await expect(page.getByRole("button",{name:"播放听力"})).toBeEnabled(); await page.getByRole("button",{name:"播放听力"}).click();
  await expect(page.getByRole("button",{name:"播放听力"})).toBeDisabled();
  await page.getByLabel("By bus",{exact:true}).check(); await page.getByRole("button",{name:"提交并查看解析"}).click();
  await expect(page.getByRole("button",{name:"播放听力"})).toBeEnabled(); await page.getByRole("button",{name:"显示原文进行精听"}).click();
  await expect(page.locator(".pet-prep-text")).toContainText("take the bus");
});
