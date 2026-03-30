# Kadaclaw

Kadaclaw 是一个基于 OpenClaw 打造的客户端，把聊天、runtime 管理和本地技能管理整合进同一个应用中。

它主要解决三件事：

- 聊天工作台
- OpenClaw runtime 管理
- 本地技能管理

## 当前页面

- `#/workspace`：聊天工作台
- `#/installed`：已安装技能
- `#/settings`：runtime 与模型配置
- `#/skills`：私有 Skillshub 预留页

## 快速开始

```bash
yarn
yarn dev
yarn tauri:dev
```

构建：

```bash
yarn build
yarn tauri:build
```

## 技术栈

- Tauri 2
- React 19
- Ant Design 6
- Zustand
- TypeScript
- Rspack

## 说明

Kadaclaw 前端通过 Tauri command 调用本机 OpenClaw runtime，因此聊天、技能识别和 runtime 管理都依赖桌面端能力。

更多说明见 `docs/runtime-validation.md`。
