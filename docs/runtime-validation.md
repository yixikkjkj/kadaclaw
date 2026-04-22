# Agent 运行时验证

这份文档用于说明 Kadaclaw 内置 Agent 后端的结构、配置验证项含义、平台差异和发布验收步骤。

## 架构概述

Kadaclaw 使用 **内置 Rust Agent 后端**，无需安装任何外部 runtime。所有 AI 能力（LLM 调用、工具执行、技能管理）均由嵌入在桌面应用中的 Rust 模块提供。

核心组件：

| 组件 | 说明 |
| ---- | ---- |
| `AgentRuntime` | 主 Agent 循环，管理 LLM 调用、工具执行、会话上下文 |
| `ToolRegistry` | 内置工具注册表，包含文件操作、网络、浏览器控制等 |
| `Provider` | LLM 提供商适配层（OpenAI / Anthropic / Ollama 兼容） |
| `SkillManager` | 技能管理器，支持本地技能目录安装与热更新 |

## 数据目录结构

Kadaclaw 使用 Tauri 动态计算的用户数据目录存储所有运行时数据，不依赖固定绝对路径。

典型目录结构：

- 应用配置：`<app-data>/config.json`
- 聊天历史：`<app-data>/history/`
- 工作目录：`<app-data>/workspace/`
- 技能目录：`<app-data>/skills/`

说明：

- `<app-data>` 是 Tauri 在当前用户机器上动态计算的私有数据目录，不同机器会不同。
- 前端应始终通过 Tauri 命令读取后端返回的真实路径，不应硬编码路径。

## 配置验证

### Provider 配置

在 `Settings > Provider` 中完成配置后，Agent 就绪状态取决于：

- `通过`：已配置 API Key，provider 可用。
- `未配置`：API Key 为空。进入设置页补全。
- `失败`：API Key 存在但调用返回错误（密钥无效、网络不通等）。

支持的 Provider：

| Provider | 备注 |
| -------- | ---- |
| OpenAI | 需要 API Key，支持自定义 apiBase |
| Anthropic | 需要 API Key |
| Ollama | 本地运行，无需 API Key，默认 `http://localhost:11434` |
| DeepSeek | 与 OpenAI 协议兼容，填写 apiBase 为 `https://api.deepseek.com` |
| 其他 OpenAI 兼容 | 填写自定义 apiBase 即可 |

### 工具配置

`Settings > 工具` 中显示所有内置工具的启用状态。未勾选的工具不会出现在 LLM 可用工具列表中。

内置工具类别：

| 类别 | 工具 |
| ---- | ---- |
| 文件操作 | `read_file`, `write_file`, `edit_file`, `list_dir` |
| 代码执行 | `exec` |
| 网络 | `web_fetch`, `web_search` |
| 浏览器 | `browse` |

### 技能配置

技能是用户自定义的工具扩展。支持从本地目录或 URL 安装。安装后技能会出现在 `Skills` 页面。

## 发布验收流程

建议在每次准备发布桌面包前执行：

```bash
yarn check:smoke
```

然后人工完成以下验证：

1. 启动桌面应用，进入 `Settings > Provider`。
2. 填写 API Key，确认右上角状态指示变为 `Agent 已就绪`。
3. 在聊天框发送一条消息，确认 LLM 能正常响应。
4. 确认工具列表能正常加载（Settings > 工具 页面显示工具名称，不出现 `[object Object]`）。
5. 进入 `Skills` 页面，确认已安装技能列表正常显示。
6. 测试文件操作工具：要求 Agent 列出工作目录文件。
7. 确认应用关闭后重启仍能读取历史会话。

## 平台注意事项

### macOS / Linux

- 所有工具均正常支持。
- `exec` 工具使用 `/bin/sh -c` 执行命令。
- 浏览器工具需要 Chrome/Chromium 可通过 CDP 连接。

### Windows

- `exec` 工具使用 `cmd /C` 执行命令，子进程在后台运行（无可见终端窗口）。
- Release 构建使用 Windows GUI 子系统，不会出现控制台窗口。
- 浏览器工具需要 Chrome 支持 CDP，确认 `chromeExecutable` 配置或 Chrome 在系统 PATH 中。

## 常见问题

| 问题 | 可能原因 | 解决方案 |
| ---- | -------- | -------- |
| Agent 状态为「未配置」 | API Key 为空 | 进入 Settings 填写 API Key 并保存 |
| LLM 调用失败 | API Key 无效或网络问题 | 检查密钥是否正确；检查网络连接 |
| 工具列表为空 | 配置文件中 `enabledTools` 为空数组 | 在 Settings > 工具 中启用工具并保存 |
| 技能安装失败 | 目录格式不正确 | 确认目录下存在 `skill.json` 文件 |
| 启动时出现控制台窗口 | 使用 debug 构建运行 | 使用 release 构建（`yarn tauri:build`）后安装 |
