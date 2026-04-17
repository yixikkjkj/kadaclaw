---
name: chrome-live-operator
description: Use this skill when the user wants to operate their currently signed-in Chrome session through OpenClaw's existing-session browser mode, especially for opening pages, clicking UI, filling forms, reading logged-in content, or completing browser tasks that depend on the user's real cookies and sessions.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Chrome Live Operator

目标：在用户**当前已登录的 Chrome 会话**里执行真实浏览器操作，而不是使用隔离浏览器或无头浏览器。

## 适用场景

- 打开用户当前 Chrome 里的页面并继续操作
- 读取已登录网站中的内容
- 在网页里点击按钮、填写表单、切换标签页
- 用户明确要求“操作我现在的 Chrome”“使用我当前登录状态”“复用我的 cookie/session”

## 风险边界

这是高权限能力。该 skill 操作的是用户**真实的已登录浏览器会话**。

- 只在用户明确要求时使用
- 优先执行最小必要操作
- 遇到登录、支付、发帖、删除、提交、发送、授权类动作时，必须先向用户确认
- 遇到 Chrome attach 授权弹窗时，要求用户亲自确认
- 不向用户索取账号密码

## 前置条件

开始前必须确认下面条件成立：

1. Kadaclaw / OpenClaw runtime 已启动
2. `browser.enabled` 已启用
3. 用户本机 Chrome 已打开
4. 用户已在 Chrome 中打开：
   - `chrome://inspect/#remote-debugging`
5. 用户已在该页面启用 remote debugging
6. 用户保持 Chrome 继续运行，并愿意在首次附着时接受浏览器授权提示

如果这些条件还没满足，先让用户完成，再继续。

## 浏览器档位选择

本 skill **必须优先使用**：

- `profile="user"`

这是 OpenClaw 内置的 existing-session profile，会附着到用户当前登录的 Chrome 会话。

不要默认使用隔离的 `openclaw` profile，除非用户明确说“不用我的登录状态”。

## 工作流

1. 先确认用户要完成的浏览器任务，拆成最小步骤
2. 确认 Chrome live attach 的前置条件是否满足
3. 使用 `profile="user"` 建立 existing-session 连接
4. 先读取当前 tabs / snapshot，确认已经附着到用户真实浏览器
5. 通过 snapshot refs 执行后续动作
6. 每完成关键步骤后，简短汇报结果
7. 如果页面出现登录验证、验证码、支付确认、权限弹窗，暂停并让用户亲自处理

## 执行规则

- 先 `tabs` 或 `snapshot`，后点击和输入
- 现有 existing-session 模式优先使用 ref，不要依赖 CSS selector
- 如果浏览器工具报 `No pages available in the connected browser`：
  - 先执行 `navigate`
  - 再重试 snapshot / actions
- 如果 attach 失败：
  - 检查 Chrome 是否已打开
  - 检查 `chrome://inspect/#remote-debugging` 是否已启用
  - 检查用户是否接受了 Chrome attach 提示

## 常见动作模式

### 打开一个网页并读取内容

1. `navigate` 到目标地址，使用 `profile="user"`
2. `snapshot`
3. 基于 snapshot refs 读取关键区域

### 点击 / 输入 / 提交表单

1. `snapshot`
2. 找到输入框和按钮对应的 ref
3. `click <ref>`
4. `type <ref> "..."` 或 `fill`
5. 必要时 `press Enter`
6. 再次 `snapshot` 验证结果

### 切换用户已打开的标签页

1. 先 `tabs`
2. 识别目标 tab
3. `focus` 到目标 tab
4. `snapshot`

## 必须向用户确认的动作

下面动作默认不能直接执行，必须先确认：

- 登录
- 登出
- 提交订单
- 付款
- 发帖
- 发消息
- 删除
- 下载未知文件
- 修改账号设置
- 授权第三方应用

确认方式可以简单直接，例如：

- “我已经定位到发布按钮了，要现在点发布吗？”
- “这一步会提交表单，要继续吗？”

## 输出要求

- 过程汇报要短，不要展开底层协议细节
- 结束时明确告诉用户：
  - 已完成什么
  - 当前停在哪一步
  - 是否还需要用户在浏览器里手动确认

## 示例请求

- “用我现在登录的 Chrome 打开飞书后台，帮我进入机器人设置页。”
- “在我当前 Chrome 里打开淘宝卖家中心，帮我找到订单导出入口。”
- “用我现在的登录状态打开某个网页，读取里面的表格内容。”
- “在我当前 Chrome 里帮我填写这个表单，但提交前先停下来让我确认。”

## 不适合本 skill 的情况

- 用户只想抓公开网页，不依赖登录态
- 用户希望使用隔离浏览器
- 用户要求后台无人值守自动长期运行
- 需要批量下载、PDF 导出、复杂网络拦截等更适合 managed browser 的能力

这类情况优先考虑普通 `browser` profile 或专用 skill。
