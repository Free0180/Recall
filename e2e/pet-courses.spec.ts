import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

for (const width of [1440,430]) {
  test(`lessons teach, explain answers and preserve manual revision (${width})`,async({page})=>{
    await page.setViewportSize({width,height:932});
    const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.goto("/");await page.evaluate(()=>localStorage.setItem("pet-vocab-e2e-session","RUN1"));await page.reload();
    await page.getByRole("button",{name:"写作",exact:true}).click();
    await page.getByRole("button",{name:"先学写作表达课"}).click();
    await expect(page.getByRole("heading",{name:"写作表达：句子、段落到整篇"})).toBeVisible();
    await expect(page.getByLabel("选择课程").locator("option")).toHaveCount(6);
    await page.getByRole("button",{name:"语法与句子 讲解"}).click();
    await expect(page.getByLabel("选择课程").locator("option")).toHaveCount(11);
    await expect(page.getByRole("heading",{name:"一、先理解知识点"})).toBeVisible();
    await page.getByRole("heading",{name:"语法小课：从理解到运用"}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(tmpdir(),`pet-course-${width}.png`)});
    await page.getByRole("radio",{name:"is",exact:true}).check();
    await page.getByRole("radio",{name:"your",exact:true}).check();
    await page.getByRole("button",{name:"提交配套练习并看解析"}).click();
    await expect(page.getByText("需复习，答案：are",{exact:true})).toBeVisible();
    await page.getByLabel("我的句子练习").fill("The library is near my house. Bring your pen.");
    await page.getByLabel("本课独立原稿").fill("The park is near my house. We can play there.");
    await page.getByRole("button",{name:"提交本课原稿并保留"}).click();
    await expect(page.getByLabel("本课独立原稿")).toHaveAttribute("readonly","");
    await page.getByLabel("本课手工点评").fill("请补充需要携带什么。");
    await page.getByRole("textbox",{name:"本课修改稿",exact:true}).fill("The park is near my house. We can play there. Please bring your ball.");
    await page.getByLabel("已由家长或老师复查本课修改稿").check();
    const download=page.waitForEvent("download");await page.getByRole("button",{name:"导出本课点评材料"}).click();expect((await download).suggestedFilename()).toBe("PET-lesson-c-be.txt");
    await page.reload();await page.getByRole("button",{name:"备考",exact:true}).click();await page.getByRole("button",{name:"语法与句子 讲解"}).click();
    await expect(page.getByLabel("本课独立原稿")).toHaveValue("The park is near my house. We can play there.");
    await expect(page.getByRole("textbox",{name:"本课修改稿",exact:true})).toHaveValue(/bring your ball/);
    await expect(page.getByLabel("已由家长或老师复查本课修改稿")).toBeChecked();
    await page.getByRole("button",{name:"家长复盘 学习报告"}).click();
    const backupPromise=page.waitForEvent("download");await page.getByRole("button",{name:"导出备考备份",exact:true}).click();const backup=await backupPromise;
    page.once("dialog",d=>d.accept());await page.getByLabel("恢复备考备份").setInputFiles((await backup.path())!);
    await page.getByRole("button",{name:"语法与句子 讲解"}).click();await expect(page.getByLabel("本课手工点评")).toHaveValue("请补充需要携带什么。");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole("button",{name:"我的",exact:true}).click();await page.getByRole("button",{name:"退出登录"}).click();
    await page.getByLabel("用户名").fill("RUN2");await page.locator("#pet-password").fill("e2e-test-only-password");await page.getByRole("button",{name:"登录",exact:true}).click();
    await page.getByRole("button",{name:"备考",exact:true}).click();await page.getByRole("button",{name:"语法与句子 讲解"}).click();await expect(page.getByLabel("本课独立原稿")).toHaveValue("");
    expect(errors).toEqual([]);
  });
}
