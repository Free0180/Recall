# 免费数据库与音频配置

## 当前实现和上线状态

本次已在代码中实现学习进度、错词、学习计划、每日听写/文章和语音偏好的同步；包含数据库迁移及本地 PostgreSQL 权限测试。项目所有者已在现有 Supabase 项目执行迁移，并通过截图确认五张表已启用 RLS、12 个账号已登记、两个函数存在。上线后的真实账号隔离及多设备同步仍需验收。

没有 Supabase 管理账号时，需要先找回原项目账号，或由项目所有者注册免费账号。应用的 FREE1/RUN1 是学习账号，不能用来登录 Supabase 管理台。注册、验证码及密码由本人完成，不要把密码发给开发助手。

只选择 Free 方案，不启用 Pro、付费语音、付费 Storage 或付费 AI。当前官方 Free 包含 500 MB 数据库，但有流量及闲置暂停限制；以 [Supabase 官方价格页](https://supabase.com/pricing) 为准。本次音频使用 GitHub Pages 静态文件和本机缓存，不使用 Supabase Storage。

## 建立数据库

1. 登录 [Supabase 管理台](https://supabase.com/dashboard)。优先使用已有项目；如果找不到旧项目，先确认是否用 GitHub 登录过，避免重复创建。
2. 如需新项目，选择 Free 组织，数据库密码自行保管。按照 `SUPABASE_SETUP_CN.md` 创建固定 Auth 用户，并关闭自主注册。新项目的用户 ID 与旧项目不同，原登录会话不能沿用。
3. 在该项目 SQL Editor 中执行 `supabase/migrations/202609110001_pet_learning_sync.sql` 的完整内容一次。脚本使用事务，不修改现有 Auth 密码。执行成功后，Table Editor 应有下列五张表，全部启用 RLS。
4. 前端继续使用 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY` 两个公开配置。管理密码、secret key 和 service_role key 都不能用于前端。
5. 发布更新后，用 RUN1 在设备 A 学习，等待“学习进度与语音设置已同步”；用设备 B 登录同一账号，确认收到进度。RUN2 应看不到 RUN1 的记录。

| 数据表 | 用途 |
| --- | --- |
| pet_profiles | 固定 Auth 用户 ID、账号名及受保护的管理员角色 |
| pet_learning_snapshots | 完整学习状态及服务端版本号，保留现有计划结构 |
| pet_word_progress | 当前单词熟悉度，包括错词 |
| pet_review_records | 最近最多 500 条评分记录 |
| pet_user_settings | 语音选择及发音方式 |

前三类学习投影和语音设置由 `pet_save_learning` 在一个事务中更新，前端不能直接写表。请求中的用户 ID 必须等于 `auth.uid()`，并且必须已登记在 `pet_profiles`。管理员 `pet_learning_summary()` 仅返回账号名、已学/已掌握数量和更新时间，不暴露密码、原始进度或文章。管理员汇总页面留待后续阶段，现有页面仍是本机概览。

脚本在执行时登记已存在的固定用户。之后补建固定 Auth 用户时，由项目所有者在 SQL Editor 执行以下登记语句；前端无法自行登记或提升权限：

```sql
insert into public.pet_profiles(user_id, username, role)
select id, upper(split_part(email, '@', 1)),
  case when lower(split_part(email, '@', 1)) in ('free1', 'free2') then 'admin' else 'learner' end
from auth.users
where lower(email) ~ '^(free[12]|run([1-9]|10))@pet-vocab\.invalid$'
on conflict do nothing;
```

## 同步行为与备份

- 修改后约一秒尝试同步；回到页面、恢复联网或每分钟在可见页面重试，也可点“立即同步”。
- 先保存本机待同步副本，再上传。断网、数据库未配置或登录失效时提示错误，学习记录继续留在本机。
- 不依赖设备时间覆盖数据。两个设备都有改动时暂停同步，让用户选择本机或云端版本；不自动合并两个学习计划。
- 选择前将两份数据写入本机冲突备份。用“导出冲突备份”下载备份集合，其中 `local`、`cloud.payload` 是各自的学习 JSON 字符串；解析对应字符串为独立 JSON 文件后可通过普通备份恢复入口恢复。不要直接把冲突集合当作学习备份导入。
- 普通“导出 JSON 备份”继续可用，并包含语音设置。它不包含另行导入的阅读原文、听力时间轴或音频。
- 阅读原文、听力时间轴及用户导入音频尚未云同步。不会把本地音频文件上传到第三方服务。

## 音频使用

“我的 > 朗读与音频”支持自动、优先系统语音和优先兼容音频，另有英语声音选择、试听及停止。选择随学习账号保存及同步；其他设备没有该声音时自动选择可用英语，优先英式。

系统朗读整理 PDF 换行与多余空白，等待语音列表更新，完整句子播放结束后不再无谓取消语音队列。用户主动停止或切换播放仍会取消旧声音。

现有 25 个 WAV 文件包含 2483 条索引文本，覆盖核心/扩展词库、核心例句和音节，合计约 72 MiB。它们是 Microsoft Zira 的美式合成音频，不是英式神经语音，也不是人工录音。本次没有生成新的英式音频：本机未安装英式引擎，也未接入付费语音服务。

在正式 PWA 联网打开并刷新后，可点“下载离线兼容音频（美式）”。下载完整文件后，Service Worker 支持音频分段请求，允许离线定位和播放。中断后重试会跳过已保存文件；清理浏览器数据或系统回收缓存后需要重新下载。建议 Wi-Fi 下载。动态文章仍依赖设备英语系统语音，Cambridge 官方音频仍沿用既有来源。

## 开发验证

```text
node node_modules/vitest/vitest.mjs run src/pet
node node_modules/typescript/bin/tsc -b --noEmit
node node_modules/eslint/bin/eslint.js src/pet vite.config.ts e2e/pet-cloud-audio.spec.ts
node node_modules/vite/bin/vite.js build --mode pages
node node_modules/@playwright/test/cli.js test --config=playwright.pet.config.ts e2e/pet-cloud-audio.spec.ts e2e/pet-speech.spec.ts
```

`cloud-database.test.ts` 在 PGlite 的 PostgreSQL 引擎执行实际迁移和角色权限检查，不连接生产。上线仍需真实 Supabase 的 Auth/PostgREST 两账号验收。
