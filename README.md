# Kadaclaw

Kadaclaw 是一个桌面端优先的 OpenClaw 客户端，目标是做成类似 QClaw 的中文产品壳。它不是单纯的前端 UI，而是把 `OpenClaw runtime`、聊天窗口、技能市场、本地技能目录和运行时配置都收进一个 `Tauri + React` 客户端里。

## 技术栈

- Tauri 2
- React 18
- Ant Design 5
- Zustand
- TypeScript
- Rspack

## 当前能力

- 中文桌面界面
- 工作台聊天窗口
- OpenClaw 控制台嵌入
- 技能市场与已安装技能页
- 内置 OpenClaw 安装、启动、探测、升级
- 模型与 Provider 授权配置
- 本地 skills 目录安装与 OpenClaw 技能识别同步

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

启动桌面客户端：

```bash
npm run tauri:dev
```

构建前端：

```bash
npm run build
```

构建桌面安装包：

```bash
npm run tauri:build
```

联合检查：

```bash
npm run check
```

刷新桌面应用图标：

```bash
npm run icons:generate
```

当前会从 `src-tauri/icons/icon.png` 生成：

- `src-tauri/icons/icon.ico`
- `src-tauri/icons/icon.icns`

## 目录与数据落点

Kadaclaw 维护两套配置：

- Kadaclaw 自己的应用配置
  - macOS: `~/Library/Application Support/com.kadaclaw.app/openclaw.json`
- 内置 OpenClaw runtime 私有目录
  - macOS: `~/Library/Application Support/com.kadaclaw.app/openclaw-runtime`

内置 runtime 目录当前包含：

- `bin/openclaw`
- `config/openclaw.json`
- `state/`
- `skills/`

其中：

- Kadaclaw 的窗口配置、启动参数、base URL 存在应用配置 `openclaw.json`
- OpenClaw 自己会真正读取的 runtime 配置存在 `openclaw-runtime/config/openclaw.json`

## Kadaclaw 如何和 OpenClaw 通信

当前通信方式不是浏览器直连，而是：

1. React 前端通过 `@tauri-apps/api/core` 调用 Tauri command
2. Tauri Rust 层在本机执行 `openclaw` CLI 或访问本地 HTTP endpoint
3. OpenClaw runtime 在本地回传结果
4. Rust 将结果返回给前端

前端封装入口在：

- [src/lib/openclaw.ts](./src/lib/openclaw.ts)
- [src/lib/skills.ts](./src/lib/skills.ts)

Rust 侧核心命令在：

- [src-tauri/src/lib.rs](./src-tauri/src/lib.rs)

### Runtime 探测

Kadaclaw 通过本地 HTTP 检测 runtime 可达性。当前默认探测地址是：

- `http://127.0.0.1:18789/`

对应命令：

- `probe_openclaw_runtime`
- `ensure_openclaw_runtime`
- `launch_openclaw_runtime`

### Dashboard 嵌入

Kadaclaw 不硬编码 dashboard URL，而是调用：

```bash
openclaw dashboard --no-open
```

然后从输出中解析真实 dashboard 地址，再嵌入到工作台 iframe 中。

### 聊天窗口

聊天窗口不是 mock，也不是直接自己拼 WebSocket 协议，而是通过本地 CLI 调用：

```bash
openclaw agent --session-id <session-id> --message <text>
```

当前实现特征：

- Kadaclaw 为主聊天窗口维护固定 session id
- 若 runtime 尚未在线，Rust 层会先尝试拉起 runtime
- 命令成功后把 stdout 作为回复内容回传前端
- 命令失败时，把 stderr/stdout 中的错误透传给聊天窗口

这意味着：

- 聊天能力依赖 OpenClaw runtime 已运行
- 聊天能力依赖 Provider 模型授权已配置

### 技能市场与本地 skills

技能安装不是只改前端状态。Kadaclaw 当前会把技能写入内置 runtime 的私有 skills 目录：

- `openclaw-runtime/skills/<skill-id>/skill.json`
- `openclaw-runtime/skills/<skill-id>/SKILL.md`

同时 Kadaclaw 会把该目录自动注册进 OpenClaw runtime 配置的：

- `skills.load.extraDirs`

技能识别状态通过下面的命令同步：

```bash
openclaw skills list --json
```

## OpenClaw 是如何和客户端一起“打包”的

当前不是把 OpenClaw 二进制直接静态塞进仓库，而是采用“客户端内置安装器”模式：

1. Tauri 应用启动后，用户点击“一键安装内置 OpenClaw”
2. Rust 层执行官方安装脚本
3. OpenClaw CLI 被安装到应用私有目录
4. Kadaclaw 自动把自身配置切到这个内置 runtime

当前安装命令等价于：

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- --prefix "<app-local-data>/openclaw-runtime" --version latest
```

也就是说，当前产品形态更准确地说是：

- 桌面客户端和 OpenClaw 一起交付
- OpenClaw 被安装到 Kadaclaw 私有目录
- 用户不需要先单独手工装系统级 OpenClaw

但它不是“构建时完全离线内嵌二进制”，而是“首次运行时由客户端代装”。

## 模型与授权配置

设置页里的“模型与授权”面板会直接修改内置 OpenClaw runtime 的真实配置：

- 写入默认模型到 runtime 配置
- 写入 Provider 对应的 API key 到 runtime 配置的 `env`

当前已支持的 Provider：

- `anthropic`
- `openai`
- `openrouter`
- `deepseek`
- `google`

当前映射的环境变量名：

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`

注意：

- Kadaclaw 只负责把 key 写进内置 runtime 配置
- 真正调用模型的仍然是 OpenClaw
- 如果未配置 key，聊天窗口会失败，并显示 OpenClaw 返回的授权错误

## OpenClaw 如何更新

当前更新策略分两层。

### 1. 内置 OpenClaw runtime 更新

设置页里的“升级内置 OpenClaw”本质上会再次执行安装器，目标仍然是同一个私有目录：

- 入口命令：`upgrade_bundled_openclaw_runtime`
- 当前实现：复用安装流程覆盖到现有 prefix

这意味着当前版本的更新行为是：

- 重新安装最新 OpenClaw CLI 到应用私有目录
- 保留 Kadaclaw 的托管结构
- 更新后通常需要重新启动 runtime

### 2. Kadaclaw 客户端自身更新

目前仓库里还没有接 Tauri updater，所以客户端本身还没有自动更新链路。当前只能通过重新构建/重新安装 Kadaclaw 包来更新客户端。

换句话说，当前状态是：

- `OpenClaw runtime` 已有应用内升级入口
- `Kadaclaw app` 还没有自动更新机制

## 当前限制

- 浏览器版本不作为目标形态，当前项目按纯桌面客户端设计
- 聊天窗口依赖 OpenClaw CLI 输出，后续可以再升级成更稳定的结构化响应
- 技能安装目前已经能写入本地 skills 目录并被 OpenClaw 识别，但生成的 skill 内容仍然偏脚手架
- OpenClaw 首次安装当前依赖联网下载安装脚本，不是离线捆绑

## 推荐的产品化下一步

1. 把首次安装流程做成更完整的状态机和进度 UI
2. 给 Kadaclaw 本体接 Tauri updater
3. 把技能安装从脚手架目录升级成更真实的 OpenClaw skill 包结构
4. 把聊天调用从 CLI stdout 解析逐步过渡到更稳定的结构化协议
