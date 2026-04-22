# Kadaclaw — Rust 后端 (src-tauri)

内置 Tauri 桌面应用的 Rust 后端，提供 AI Agent 对话、工具执行、技能管理等全部能力，无需任何外部 runtime 进程。

## 快速上手

```bash
# 检查 Rust 编译，确认零警告
cd src-tauri && cargo check

# 运行测试
cargo test

# 构建 Release（在项目根目录）
yarn tauri:build
```

## 目录结构

```
src-tauri/src/
├── lib.rs              # Tauri 入口，注册 .manage() / .invoke_handler()
├── main.rs             # 精简入口，仅调用 lib::run()
├── util/               # 工具层：语言工具、第三方库封装
│   ├── error.rs        # ★ KadaError 枚举，统一 Result<T>
│   ├── fs.rs           # 目录创建、递归复制、ZIP 解压
│   └── constants.rs    # 常量（含 dead_code 允许项）
├── base/               # 核心业务基础层
│   ├── models.rs       # ★ 所有 DTO（AgentConfig, ChatHistorySession 等）
│   ├── config.rs       # 配置文件读写（~/.local/share/kadaclaw/config.json）
│   ├── history.rs      # 聊天历史 JSON 持久化
│   ├── runtime_config.rs # 技能安装目录、bundled 布局
│   ├── agent/
│   │   ├── runtime.rs  # ★ AgentRuntime：LLM 循环 + 工具执行 + 流式推送
│   │   ├── context.rs  # ConversationContext：会话消息管理，40k char 截断
│   │   └── stream.rs   # AgentStreamEvent：序列化到前端的事件枚举
│   ├── providers/      # LLM 提供商（OpenAI / Anthropic / Ollama）
│   │   ├── mod.rs      # ★ Provider trait, ChatMessage, StreamChunk
│   │   ├── factory.rs  # 根据 config 创建 Arc<dyn Provider>
│   │   ├── openai.rs   # OpenAI 兼容 SSE 流
│   │   ├── anthropic.rs # Anthropic messages API
│   │   └── ollama.rs   # 复用 OpenAIProvider，指向本地端口
│   ├── tools/
│   │   ├── mod.rs      # ★ Tool trait, ToolContext
│   │   ├── registry.rs # ToolRegistry：注册、过滤、列举
│   │   ├── fs.rs       # read_file / write_file / edit_file / list_dir / exec_skill_script
│   │   ├── exec.rs     # exec（shell，含危险命令过滤）
│   │   ├── web.rs      # web_fetch / web_search（DuckDuckGo / Tavily）
│   │   ├── browser.rs  # browse（Chrome CDP）
│   │   └── mcp/        # MCP 协议客户端和服务器管理（基础设施，待完善）
│   └── skills/         # Rhai 脚本引擎 + 技能管理（基础设施，待完善）
├── share/              # 跨层共享代码（不属于单一业务线）
│   ├── agent.rs        # ★ AppAgentState（Tauri managed state）
│   ├── provider.rs     # Provider 元数据映射
│   └── skills.rs       # 技能目录发现、ZIP 安装、启用状态管理
└── action/             # Tauri IPC handlers（直接对应前端 invoke 调用）
    ├── chat.rs         # ★ send_message / stop_message
    ├── config.rs       # get_agent_config / save_agent_config / list_configured_providers
    ├── tools.rs        # list_available_tools
    └── skills.rs       # list_installed_skills / install_skill_* / set_skill_enabled
```

## 数据流：一条消息的完整链路

```
前端 invoke("send_message", { message, sessionId, channel })
  │
  ▼ action/chat.rs::send_message()
  1. 读取 AgentConfig（tools / provider / system_prompt / maxToolRounds）
  2. factory::create_provider() → Arc<dyn Provider>
  3. ToolRegistry::new().get_tools_for_session(enabled_tools)
  4. AppAgentState::get_or_create_session(sessionId)
  │
  ▼ AgentRuntime::run(&mut ctx, user_message, channel, stop_flag)
  ┌── FOR round in 0..max_tool_rounds ──────────────────────────────┐
  │  a. ctx.messages_with_system() → 构建完整消息链               │
  │  b. tokio::spawn(provider.chat_stream(messages, schemas, tx))  │
  │  c. while let Some(chunk) = rx.recv():                        │
  │     - TextDelta  → channel.send(AgentStreamEvent::TextDelta)   │
  │     - Done{tool_calls} → 解析工具调用                         │
  │  d. 若有 tool_calls:                                          │
  │     - 发送 ToolCallStart 事件                                 │
  │     - tool.call(&ctx, args).await → String 结果              │
  │     - 发送 ToolCallResult 事件                                │
  │     - ctx.add(ChatMessage::tool_result(...))                   │
  │  e. 无 tool_calls → 发送 Done 事件，退出循环                  │
  └─────────────────────────────────────────────────────────────────┘
  │
  ▼ AppAgentState::save_session(ctx)
  │
  ▼ 前端 Channel 接收：[TextDelta...] [ToolCallStart] [ToolCallResult] [Done]
```

## 关键约定

### 错误处理

所有函数返回 `crate::util::error::Result<T>`，即 `std::result::Result<T, KadaError>`。
IPC handler 返回 `Result<T, String>`（Tauri 要求）：用 `.map_err(|e| e.to_string())`。

```rust
// 定义新错误
#[derive(Debug, thiserror::Error)]
pub enum KadaError {
  #[error("{0}")] MyModule(String),
  // ...
}
```

### 新增工具

1. 在 `base/tools/` 下创建文件，实现 `Tool` trait：
   - `name()` → 工具名（snake_case，如 `"my_tool"`）
   - `parameters_schema()` → OpenAI JSON Schema 对象
   - `call(&self, ctx: &ToolContext, args: Value) -> Result<String>`
2. 在 `base/tools/registry.rs` 的 `ToolRegistry::new()` 中 `reg.register(MyTool)` 注册
3. 工具无需其他配置，自动出现在前端工具列表

### 新增 Provider

1. 在 `base/providers/` 下创建文件，实现 `Provider` trait（见 `mod.rs`）
2. 核心方法：`async fn chat_stream(&self, messages, tools, tx: mpsc::Sender<StreamChunk>)`
3. 在 `factory.rs` 的 `create_provider()` 中添加 `match` 分支
4. 在 `base/models.rs` 的 AgentConfig 中添加对应 provider key

### 新增 IPC Command

1. 在对应 `action/*.rs` 文件中添加 `#[tauri::command]` 函数
2. 在 `lib.rs` 的 `invoke_handler![]` 宏中注册
3. 前端在 `src/api/agent.ts` 中添加 `invoke<ReturnType>("command_name", params)` 封装

### Tauri Managed State

唯一的共享状态是 `AppAgentState`（`share/agent.rs`），通过 `.manage()` 注入。
IPC 函数通过 `agent_state: tauri::State<'_, AppAgentState>` 获取。

```rust
pub struct AppAgentState {
  pub stop_flag: Arc<AtomicBool>,   // 全局停止信号
  pub sessions: Arc<Mutex<HashMap<String, ConversationContext>>>,  // 内存会话
}
```

会话消息**仅保存在内存**中。持久化聊天历史由 `action/chat.rs` 里的 `get_chat_history / save_chat_history` 另行处理（JSON 文件）。

### 路径处理

工具内统一使用 `resolve_path(raw, &ctx.work_dir)` 解析三种路径形式：
- `~/xxx` → 用户 Home 目录
- `/absolute` → 绝对路径
- `relative` → 相对 `ctx.work_dir`（`$DATA_DIR/workspace`）

### Windows 构建

`main.rs` 开头有 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`，确保 Release 构建不弹出控制台窗口。Debug 构建（`cargo run`）会显示控制台，属正常行为。

## 当前 dead_code 说明

以下模块是**预留基础设施**，用 `#[allow(dead_code)]` 静默，不代表废弃：

| 模块                | 说明                                        |
| ------------------- | ------------------------------------------- |
| `base/skills/`      | Rhai 脚本引擎，技能系统待完整接入           |
| `base/tools/mcp/`   | MCP 协议客户端，MCP 服务器管理待完善        |
| `share/provider.rs` | Provider 元数据（环境变量名等），待 UI 接入 |
| `Provider::chat()`  | 非流式 chat 接口，目前只用流式版本          |

## 常见陷阱

| 场景                  | 陷阱                                 | 正确做法                                              |
| --------------------- | ------------------------------------ | ----------------------------------------------------- |
| 新增工具后前端看不到  | 忘记在 `registry.rs` 注册            | 必须 `reg.register(MyTool)`                           |
| IPC 返回 `Vec<Value>` | 前端会将对象渲染为 `[object Object]` | 返回 `Vec<String>` 或明确的可序列化类型               |
| 工具超时              | exec 默认 120s，网络工具 30s         | 调整 `ToolContext` 超时参数                           |
| Chrome CDP 连接失败   | browse 工具失败无明确提示            | 需以 `--remote-debugging-port=9222` 启动 Chrome       |
| 上下文过长            | 消息历史不断增长                     | `ConversationContext` 在 40k char 时自动截断最旧 turn |
| 并发写 sessions       | 多个 IPC 并发会 deadlock             | 用 `Mutex::lock().await`，已在 `AppAgentState` 中封装 |

## 相关文档

- [架构设计与能力说明](../docs/runtime-validation.md)
- [Tauri IPC 配置与权限](capabilities/default.json)
- [前端 API 层](../src/api/agent.ts)
- [应用主配置](tauri.conf.json)
