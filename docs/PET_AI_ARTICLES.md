# PET 每日学习与 AI 文章

> 2026-09-10 更新：按用户要求，学习页现已使用 `offline-article.ts` 在本地生成文章，不调用本文中的 AI 接口，也不需要部署云函数。默认新词数量已改为 10。本文其余部分仅保留此前 AI 方案的历史配置说明，当前行为以 `PET_README_CN.md` 为准。

## 学习周期

首次启用时以账号当前设备的本地日期为第 1 天，不强制从星期一开始。每天零点进入下一个自然日，页面恢复前台时也会核对日期。

第 1 至 5 天默认每天安排 6 个尚未学过的重点词，周期创建时固定五天词表。第 6 天从本周期前五天的每日打分记录中选出 `again` 和 `learning`，优先排列 `again`，前一半向上取整分给第 6 天，剩余分给第 7 天。重新打分不改变已分配的两批词。

空复习池显示无任务，不会生成空文章。未登录或未完成的日期按自然日经过，不伪造完成记录；没有打分的新词在未来周期仍可被分配。前一日错过的任务不会自动延长本周期。只有 30 个重点词参与计划，2354 词扩展库仍是查询库。已学完重点词后不把已学词伪装成新词，可在错词本自由复习。

每天完成所有词的熟悉度打分后，解锁同一词表的听写，并自动请求文章，二者可同时进行。听写输错可查看答案再试，必须拼写正确才计为完成。自由练习不填充当天计划。周期、每日打分、听写结果与文章存于现有按用户名隔离的 `pet-vocab-progress-v2-*` 中，随 JSON 备份一起导出；旧备份保留原有词汇进度，并首次创建周期。

## 服务端接口

前端使用现有 Supabase 登录会话调用 `pet-daily-article` 云函数。浏览器不接收 AI 密钥。函数向 Supabase Auth 核实用户，再校验目标词 ID，最后请求兼容 Chat Completions JSON 输出的 AI 服务。

服务提示词要求一个有开头、发展和结尾的 B1 英式英语故事，通常 150 至 300 词；目标词较多时可更长。语法点参考 [Cambridge B1 Preliminary 教师手册](https://www.cambridgeenglish.org/it/Images/168150-b1-preliminary-teachers-handbook.pdf) 中的一般过去时、过去进行时、现在完成时、条件句及定语从句。内容是原创练习，不是官方考题。

前后端均检查返回格式、文章长度、全部目标词是否出现在正文，以及讲解例句是否逐字来自正文。不符合要求时不保存，展示重试入口。这些自动检查不能替代对 AI 语义、故事质量和语法正确性的人工审阅。

## 配置与部署

本次仅提供实现，未部署云函数、调用付费模型或发布网站。

1. 在自己的 AI 服务中创建 API 密钥，并确认该账号的用量及费用设置。不要将密钥写入 `VITE_*`、GitHub Pages 网页、APK 或提交到 Git。
2. 在与现有登录相同的 Supabase 项目中，打开 Edge Functions 的 Secrets 页面，新增以下三个服务端变量：

| 变量 | 内容 |
| --- | --- |
| `PET_AI_API_KEY` | AI 服务密钥 |
| `PET_AI_BASE_URL` | 支持 `/chat/completions` 的 API 基址，不包含 `/chat/completions` 本身 |
| `PET_AI_MODEL` | 该账号当前可使用的模型 ID |

Supabase 自带的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 用于核实登录。若选择 DeepSeek，API 基址可按其[官方文档](https://api-docs.deepseek.com/api/create-chat-completion/)设置为 `https://api.deepseek.com`，模型 ID 以账号可用列表为准，不在代码中写死。

3. 使用已登录的 Supabase CLI，在项目根目录执行（将 `YOUR_PROJECT_REF` 替换成自己的项目 ID）：

```powershell
supabase functions deploy pet-daily-article --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` 关闭网关旧式 JWT 检查，函数内部仍必须经 `/auth/v1/user` 核验真正的用户会话；未登录请求不会发送到 AI。不要删除内部鉴权逻辑。部署包需要包括函数相对引用的 `src/pet/pet-words.ts` 与 `src/pet/study-article.ts`，建议从完整项目根目录通过 CLI 部署。

4. 前端沿用 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`，不需要新增前端 AI 密钥。构建并发布更新后的网页，再用真实账号完成当天词表，检查文章生成及重新登录后的保存。

华为 APK 中的 `MainActivity.java` 加载 `https://free0180.github.io/Recall/`。本次功能位于网页，网页发布后应用可加载更新；通常无需重新打包 APK。此处不自动推送或发布。

## 缓存与边界

文章保存在当前账号的本机学习数据中。已保存的文章在刷新时不会再次生成，并可在往期文章中阅读。客户端合并进行中的同一请求；云函数在同一温实例内缓存结果一小时、合并重复请求，并限制同一用户每天最多 20 次新生成尝试。函数冷启动或多个实例之间不共享此计数，它不是全局费用上限；费用限制应在 AI 服务账号中设置。

生成需要网络。错误或超时不撤销学习记录，听写仍可使用设备语音。云函数只收到日期和词 ID，不上传用户的听写答案或整份学习历史。语音来自设备，实际华为 WebView 的语音可用性需在平板上复核。

## 验证

本地测试用的 `VITE_PET_E2E_AUTH=1` 仅在 Vite 开发模式有效。AI 响应由 Playwright 拦截，测试不会使用真实 API 或消耗模型额度。

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/eslint/bin/eslint.js src/pet supabase/functions
node node_modules/vitest/vitest.mjs run src/pet/study-cycle.test.ts src/pet/study-article.test.ts supabase/functions/pet-daily-article/index.test.ts
node node_modules/@playwright/test/cli.js test --config=playwright.pet.config.ts
node node_modules/vite/bin/vite.js build
```

截图默认输出系统临时目录中的 `pet-vocab-qa`，可通过 `PET_QA_DIR` 指定目录。真实服务鉴权、供应商账户/模型、线上部署与华为真机需要在配置后再验证。
