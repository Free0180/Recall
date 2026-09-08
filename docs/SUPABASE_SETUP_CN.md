# PET 词汇精读 - Supabase 安全登录配置

## 只使用公开发布密钥

浏览器端只配置以下两项：

- `VITE_SUPABASE_URL`：Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`：以 `sb_publishable_` 开头的公开发布密钥

不要在本项目、GitHub、聊天、邮件或浏览器中保存 Supabase Secret Key、Service Role Key 或数据库密码。

## 创建固定用户

在 Supabase Dashboard 的 Authentication > Users 页面，用“Create new user”创建以下账号。创建时确认用户，不发送邀请邮件：

- `free1@pet-vocab.invalid`
- `free2@pet-vocab.invalid`
- `run1@pet-vocab.invalid` 至 `run10@pet-vocab.invalid`

所有账号的初始密码只在 Supabase Dashboard 中设置，不写入源代码。使用者第一次登录后，应在应用“我的 > 修改登录密码”中立即更换密码。

应用只允许 FREE1、FREE2、RUN1 至 RUN10 登录。FREE1 和 FREE2 显示为管理员，其余账号显示为学习账号。

## 关闭自主注册

应用没有注册入口。请在 Authentication 设置中关闭新用户自主注册，避免外部人员通过 Auth API 创建额外账号。

## 设置网站地址

在 Authentication > URL Configuration 中设置：

- Site URL：`https://free0180.github.io/Recall/`
- Redirect URL：`https://free0180.github.io/Recall/**`
- 本地调试可额外加入：`http://localhost:4173/**`

## 配置 GitHub Actions 变量

进入 Free0180/Recall > Settings > Secrets and variables > Actions > Variables，新建：

1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_PUBLISHABLE_KEY`

这两项属于浏览器公开配置，不是服务器管理员密钥。完成后重新运行 Pages 工作流即可。

