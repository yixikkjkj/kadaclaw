# Runtime Validation

这份文档用于说明 Kadaclaw 内置 OpenClaw runtime 的安装位置、自检项含义、平台差异和分发验收步骤。

## 安装目录原则

Kadaclaw 不应该在前端写死某个开发者机器上的绝对路径。运行时目录由 Tauri 在当前用户机器上动态计算，然后传给前端展示。

典型目录结构：

- 应用配置：`<app-local-data>/openclaw.json`
- 内置 runtime：`<app-local-data>/openclaw-runtime`
- CLI 命令：
  - macOS / Linux: `<app-local-data>/openclaw-runtime/bin/openclaw`
  - Windows: `<app-local-data>/openclaw-runtime/bin/openclaw.cmd`
- Runtime 配置：`<app-local-data>/openclaw-runtime/config/openclaw.json`
- 技能目录：`<app-local-data>/openclaw-runtime/skills`

说明：

- `<app-local-data>` 是当前用户当前系统上的应用私有数据目录，不同机器会不同。
- Onboarding 和设置页应始终显示后端返回的真实目录，而不是仓库路径或开发机路径。
- Windows 下展示的是 Kadaclaw 生成的包装命令路径，不是 Kadaclaw 自身的包管理目录。
- 文档里提到的 `npm`，仅指 OpenClaw Windows 官方安装链路依赖的 Node.js/npm 环境，不代表 Kadaclaw 前端使用 npm。

## 安装流程

### macOS / Linux

Kadaclaw 调用官方 shell 安装器，把 OpenClaw 安装到应用私有目录，然后把当前配置切换到该目录下的 runtime。

效果等价于：

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- --prefix "<app-local-data>/openclaw-runtime" --version latest
```

### Windows

Kadaclaw 调用官方 PowerShell 安装器，然后在应用私有目录生成 `openclaw.cmd` 包装器，确保应用后续使用固定、可控的命令入口。

效果等价于：

```powershell
& ([scriptblock]::Create((Invoke-WebRequest -UseBasicParsing https://openclaw.ai/install.ps1))) -NoOnboard
```

说明：

- Windows 当前属于兼容支持，不是主推荐平台。
- 如果 PowerShell、Node.js/npm、PATH 或执行策略导致安装失败，优先建议 WSL2。
- 安装完成后 Kadaclaw 会额外执行一次 `openclaw --version`，避免把不可用命令写入配置。

## 安装后自检项

设置页的 `安装后自检` 面板由后端 `run_openclaw_self_check` 统一生成，当前包含以下项目。

### CLI 命令路径

- `通过`：已经找到可执行命令。
- `失败`：当前命令路径不存在或不可用。
- 典型处理：重新执行内置安装，或检查设置页的 `启动命令` 是否被改成了错误路径。

### 版本读取

- `通过`：`openclaw --version` 可正常返回。
- `失败`：命令存在，但执行失败或输出异常。
- 典型处理：手工验证命令可执行；Windows 下若持续失败，优先改用 WSL2。

### 内置托管

- `通过`：当前使用 Kadaclaw 私有目录下的 runtime。
- `待确认`：当前命令可能来自系统环境或外部自定义路径。
- 典型处理：如果产品希望完全托管，重新执行内置安装并保留默认命令路径。

### HTTP 探测

- `通过`：Kadaclaw 成功探测到当前 runtime endpoint。
- `失败`：runtime 尚未启动，或者 `baseUrl` / `healthPath` 与真实配置不一致。
- 典型处理：点击 `启动已安装 Runtime`，然后重新执行自检。

### 工作目录

- `通过`：设置的 `workingDirectory` 真实存在。
- `失败`：设置了不存在的目录。
- `待确认`：未设置该项，OpenClaw 将使用默认工作目录。
- 典型处理：要么改成真实目录，要么留空。

### 技能目录写入

- `通过`：Kadaclaw 对 runtime `skills` 目录具备真实写权限。
- `失败`：目录不存在、权限不足或临时写入测试失败。
- 典型处理：检查应用数据目录权限，再重新执行安装或自检。

## 分发验收流程

建议在每次准备发布桌面包前执行：

```bash
yarn check:smoke
```

然后人工完成以下验证。

1. 启动桌面应用，进入 `Settings > Runtime Hub`。
2. 点击 `一键安装内置 OpenClaw` 或 `升级内置 OpenClaw`。
3. 确认 `OpenClaw Runtime 信息` 中的 `安装目录`、`命令路径`、`技能目录` 都来自当前机器的应用数据目录。
4. 确认 `安装后自检` 里的 `CLI 命令路径`、`版本读取`、`技能目录写入` 为 `通过`。
5. 点击 `启动已安装 Runtime`，再次运行自检。
6. 确认 `HTTP 探测` 变为 `通过`。
7. 打开技能市场，安装一个 ClawHub 公共技能。
8. 确认 `已安装` 页面能看到真实 manifest 信息，且技能目录落在当前 runtime `skills` 下。

## 平台注意事项

### macOS

- 当前适配最完整。
- 分发验收时重点看安装目录是否位于应用私有数据目录，而不是开发机路径。

### Linux

- 安装流程与 macOS 相同。
- 需要额外确认 shell、网络和执行权限没有被发行版限制。

### Windows

- 已支持安装，但仍应视为兼容路径。
- 重点检查 PowerShell、Node.js/npm、PATH、执行策略，以及 `openclaw.cmd` 包装器是否可执行。
- 如果 native Windows 环境不稳定，优先建议 WSL2。

## 常见失败与处理

- 安装目录显示成固定绝对路径：前端不应写死路径，应始终使用后端返回的 `installDir`。
- 自检里 `版本读取` 失败：先手动执行 `openclaw --version`，再判断是命令损坏、PATH 问题还是 Windows 环境问题。
- 自检里 `HTTP 探测` 失败：优先检查 runtime 是否真的启动，以及 `baseUrl` / `healthPath` 是否被用户改坏。
- 技能安装成功但页面不更新：先看 `技能目录写入` 是否通过，再检查安装页是否读取到本地 manifest。
- Windows 安装后仍找不到命令：优先确认包装器是否生成在 `<app-local-data>/openclaw-runtime/bin/openclaw.cmd`，其次再查 PowerShell 和 Node.js/npm 安装链路。
