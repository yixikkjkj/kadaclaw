# agents.md

## 目标

这份文档用于给后续新项目做初始化参考，目录结构、技术栈和代码组织方式以当前仓库为基准，优先复用已经验证过的前端分层方式，而不是重新发明一套结构。

## 推荐技术栈

- 构建：Rspack
- 语言：TypeScript
- UI：React 19 + Ant Design + `@ant-design/x`
- 路由：React Router 7
- 状态管理：Zustand
- 请求层：Ky
- 代码质量：Oxlint + Oxfmt
- 样式：CSS Modules（当前项目中 `.css` 统一按 module 方式处理）
- 包管理：推荐 `pnpm`，也可按团队现状使用 `yarn`

## 推荐目录结构

如果是单主应用，建议至少保留下面这套结构：

```text
.
├── src/
│   ├── api/                  # 接口定义与接口方法
│   ├── assets/               # 静态资源
│   ├── common/               # 通用常量、请求封装、工具函数、hooks、路由常量
│   ├── components/           # 通用业务组件
│   ├── layouts/              # 页面骨架布局
│   ├── pages/                # 页面级模块
│   ├── store/                # Zustand store / view model
│   ├── index.css             # 全局样式
│   └── index.tsx             # 应用入口
├── index.html
├── package.json
├── rspack.config.ts
├── tsconfig.json
├── .oxlintrc.json
└── .oxfmtrc.json
```

## 分层约定

### `src/index.tsx`

负责：

- React 根节点挂载
- 全局 Provider 注入
- 路由创建
- 应用主题配置
- 启动前初始化，例如用户信息、配置项、埋点能力初始化

不负责：

- 业务接口拼装
- 大段页面逻辑
- 复杂状态处理

### `src/pages`

页面目录只放页面级组件，一个页面一个目录，例如：

```text
src/pages/NewChat/
├── index.tsx
└── index.css
```

适合放：

- 页面级布局
- 页面初始化逻辑
- 页面级副作用

不适合放：

- 可复用组件
- 通用 API
- 跨页面状态

### `src/components`

存放可复用业务组件，按组件名建目录，默认导出 `index.tsx` + `index.css`。

推荐规则：

- 一个组件一个目录
- 复杂组件内部可拆子文件
- 统一在 `src/components/index.ts` 做出口聚合

### `src/store`

这里建议作为 Zustand 状态层与领域状态组织层，偏向：

- 领域状态
- Zustand store
- 视图模型

新项目建议保持这个思路：

- 全局共享状态放 store
- 页面临时状态优先放组件内
- 复杂流程优先抽成 store / view model，不要把页面组件写成巨型控制器

推荐组织方式：

- 一个领域一个 store 文件
- store 文件同时包含 `state`、`actions`、必要的 selector
- 组件通过 hook 读取状态，不再额外包一层 Provider
- 跨 store 协作通过 action 调用或 service 层组合，不要互相随意读写内部实现

### `src/api`

接口层只做一件事：定义请求方法。

建议：

- 所有请求统一走 `common/request.ts`
- 每个接口方法只关心参数和返回值
- 不在 `api` 层写 UI 提示、路由跳转、复杂业务流程

### `src/common`

通用基础设施集中放这里，建议包含：

- `request.ts`：统一请求封装
- `router.ts`：路由常量和公共路由守卫
- `constants.ts`：业务常量和枚举
- `utils.ts`：纯工具函数
- `hooks.tsx`：通用 hooks

通用逻辑优先收敛在 `common`，不要散落到各个页面目录。

## 默认脚本约定

新项目建议默认提供这些脚本：

```json
{
  "scripts": {
    "dev": "rspack dev",
    "build": "rspack build",
    "preview": "rspack preview",
    "lint": "oxlint -c .oxlintrc.json",
    "format": "oxfmt"
  }
}
```

不要在项目启动初期就堆太多脚本名，先保证开发、构建、检查、格式化四类能力完整。

## 命名与文件组织

- 路径别名统一使用 `~/* -> src/*`
- 页面、组件目录使用 PascalCase，例如 `NewChat`、`RoleCard`
- 页面和组件主文件统一用 `index.tsx`
- 配套样式统一用 `index.css`
- store 文件按职责命名，例如 `session.ts`、`agentStore.ts`
- 抽象类、实体类可用大写文件名，例如 `Agent.ts`
- 路由常量统一集中定义，不在页面里手写字符串路径

## 样式约定

当前项目使用 CSS Modules，建议后续项目延续：

- 组件样式和组件放在同目录
- 避免全局样式污染
- 只在 `src/index.css` 放全局 reset、基础字体和页面级全局规则

建议：

- 颜色、阴影、间距等主题能力尽量收敛到主题配置或全局变量
- 优先复用 Ant Design Token，不要到处写散乱的 inline style
- 临时样式如果超过 3 到 5 个属性，应回收进 CSS 文件

补充规则：

- 页面级布局样式放页面目录，组件样式放组件目录
- 不要把页面专属样式提升到全局
- 能通过组件组合解决的，不优先用过深的 CSS 选择器

## 状态管理约定

Zustand 更适合拿来做新项目默认状态层，原因是：

- 接入轻量，样板代码少
- 容易按领域拆 store
- 对页面型应用足够直接
- 迁移和维护成本相对低

推荐原则：

- 业务领域状态：Zustand store
- 单个组件输入值、展开收起：组件本地 state
- 需要复用的页面逻辑：抽成 store / VM / hook

不要把所有内容都塞进全局 store，也不要把跨页面状态分散在多个页面组件内部。

推荐写法示例：

```ts
import { create } from "zustand";

interface SessionState {
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  initialized: boolean;
  setUser: (user: SessionState["user"]) => void;
  clearUser: () => void;
  init: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: undefined,
  initialized: false,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: undefined }),
  init: async () => {
    // 启动时获取登录信息
    set({ initialized: true });
  },
}));
```

约定建议：

- hook 命名统一用 `useXxxStore`
- 领域 action 用动词开头，例如 `setUser`、`fetchList`、`appendMessage`
- 异步 action 直接放 store 内，或抽到 service 后再由 store 调用
- 派生状态优先用 selector 或普通函数，不要把所有中间态都存回 store

## 路由约定

建议继续沿用 React Router 7 的集中式声明：

- 在入口统一 `createBrowserRouter`
- 路由 path 常量统一由 `common/router.ts` 导出
- 认证、权限、重定向逻辑统一走 middleware / loader

如果项目存在登录态，建议保留一层类似当前 `authMiddleware` 的入口控制，而不是在每个页面单独判断。

## 接口与数据流约定

推荐调用链：

`page/component -> store/view model -> api -> request`

这样做的好处：

- 页面更薄
- API 层稳定
- 业务流程更容易测试和迁移

流式接口、轮询、长连接这类复杂交互，建议像当前项目一样放在领域类里处理，例如 `Agent`。

如果不是聊天/流式项目，可以进一步简化成：

`page -> store -> api -> request`

如果是重交互页面，也可以采用：

`page -> hook/view model -> store/api`

## 初始化新项目时建议直接保留的脚手架

1. `Rspack + React + TypeScript` 基础构建
2. `src/api`、`src/common`、`src/components`、`src/layouts`、`src/pages`、`src/store`
3. `~` 路径别名
4. `oxlint` 与 `oxfmt`
5. `common/request.ts` 统一请求封装
6. `common/router.ts` 路由常量
7. `useSessionStore` 这类启动初始化 store

## 新增模块时放哪儿

### 新增一个页面

- 在 `src/pages/页面名/` 下创建 `index.tsx` 和 `index.css`
- 在 `common/router.ts` 增加路由常量
- 在 `src/index.tsx` 的路由配置中注册页面
- 如果页面有独立领域状态，再新增对应 store

### 新增一个通用组件

- 放到 `src/components/组件名/`
- 组件目录内维护自己的样式和子组件
- 如果需要复用，从 `src/components/index.ts` 导出

### 新增一组接口

- 按领域拆到 `src/api/xxx.ts`
- 返回值和参数类型优先补齐
- 请求统一走 `common/request.ts`

### 新增一个全局状态

- 放到 `src/store/xxx.ts`
- 命名使用 `useXxxStore`
- 一个 store 只处理一个领域，不要混杂 unrelated 状态

### 新增一个通用方法

- 纯函数放 `common/utils.ts`
- 路由常量放 `common/router.ts`
- 常量和枚举放 `common/constants.ts`
- 可复用 React 逻辑放 `common/hooks.tsx`

## 推荐开发顺序

新项目初始化或新功能开发，建议按这个顺序推进：

1. 先定页面和路由
2. 再定接口与类型
3. 然后补 store 和数据流
4. 最后拆组件和补样式

这样可以避免一开始就过度抽象，也能减少后期反复移动文件。

## TypeScript 约定

新项目默认要求类型先行，至少遵守下面这些规则：

- 禁止无理由使用 `any`
- 接口返回值、组件 props、store state 必须声明类型
- 公共类型优先抽到 `src/types/` 或领域文件顶部
- 能用字面量联合类型时，不要退化成宽泛的 `string`
- 对外暴露的方法要有明确输入输出，不要依赖隐式约定

推荐：

- 接口类型按领域命名，例如 `UserInfo`、`ChatMessage`
- 列表查询参数统一显式声明，例如 `page`、`pageSize`
- 复杂返回结构先定义 type/interface，再写页面逻辑

补充规则：

- 枚举值较少时优先使用联合类型
- DTO、表单值、页面展示类型可以分开定义，不强行共用一个类型
- nullable 字段要显式声明，不要靠运行时猜测

## 组件边界约定

组件拆分时，默认遵守下面的判断标准：

- 页面负责组织，不负责承载大量细节实现
- 通用组件负责复用，不内嵌具体页面耦合逻辑
- 业务组件可以知道业务语义，但不应该直接发起到处散落的请求
- 一个组件超过一个屏幕高度的逻辑时，优先考虑拆分

优先级建议：

- 页面内只使用一次的局部片段，先放页面目录内部
- 两个以上页面复用后，再提升到 `src/components`
- 涉及复杂状态编排时，先抽 store 或 hook，再抽 UI 组件

组件开发时再补一条：

- 组件 props 优先保持稳定和扁平，避免把整块大对象直接透传到底层

## 请求与类型约定

请求层建议固定成两层：

1. `common/request.ts`
2. `src/api/*.ts`

其中：

- `request.ts` 负责超时、鉴权、错误处理、统一响应解析
- `api/*.ts` 负责接口路径、参数、返回值

建议统一接口返回结构，如果后端是这种格式：

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;
  errorCode?: number;
  errorMessage?: string;
}
```

那么前端应该：

- 在请求层统一处理 `success`
- 在 API 层透出明确的 `T`
- 在页面和 store 层只消费真正业务数据

不要在页面里反复写：

- `res?.data?.data`
- `if (!res.success) {}`
- 重复的错误提示逻辑

推荐再加两条默认原则：

- 接口文件按领域拆分，不按 HTTP 方法拆分
- 页面不要直接使用原始 `fetch`，统一走封装后的请求层

## 路由文件约定

路由相关逻辑建议集中到两处：

- `src/common/router.ts`
- `src/index.tsx`

其中：

- `router.ts` 只放路由常量、路径拼装方法、通用守卫
- `index.tsx` 负责注册路由树

推荐写法：

```ts
export const ROUTER = {
  HOME: "/",
  DETAIL: "/detail/:id",
};
```

不要在组件里直接手写：

- `navigate('/detail/' + id)`
- `<Link to="/some-hard-code-path" />`

应该优先通过统一常量或路径函数生成。

## 实现流程约定

新增一个功能时，默认按下面顺序实现：

1. 明确页面入口和路由位置
2. 定义接口类型和调用方法
3. 设计 store 或 hook 的状态边界
4. 实现页面骨架
5. 再拆通用组件
6. 最后补异常态、空态、loading 态

这样做可以避免先写大量 UI，最后再返工数据流。

## AI 执行约定

如果后续把这份文档给 AI 或自动化代理使用，默认要求如下：

- 优先遵守目录结构，不新增随意的顶层目录
- 新增页面、组件、store、api 时，放到既定分层内
- 没有充分理由时，不引入额外状态管理库
- 没有充分理由时，不新增 UI 框架
- 优先补类型，再补逻辑，再补样式
- 修改现有功能时，优先保持原有分层和命名风格一致

禁止行为：

- 在页面文件中堆积过多请求和状态逻辑
- 把通用逻辑复制到多个页面
- 为了省事直接使用 `any`
- 在多个文件里手写重复的路由路径和接口地址
- 引入没有必要的全局状态

## 完成定义

一个功能完成，至少满足下面条件：

1. 页面能正常访问
2. 类型没有明显缺失
3. 请求走统一封装
4. 状态逻辑有明确归属
5. 样式不污染全局
6. 路由常量已收敛
7. 已执行格式化和 lint

如果这些条件还不满足，默认不算完整交付。

## 新项目初始化 Checklist

新建项目时，默认按下面清单检查：

1. 已创建 `src/api`、`src/common`、`src/components`、`src/layouts`、`src/pages`、`src/store`
2. 已配置 `~` 指向 `src`
3. 已配置 `Rspack + React + TypeScript`
4. 已接入 `Ant Design`
5. 已接入 `Zustand`
6. 已配置 `oxlint` 与 `oxfmt`
7. 已建立统一 `request.ts`
8. 已定义路由常量文件
9. 已建立 `useSessionStore` 或等价初始化 store
10. 已区分全局样式与组件样式

如果这 10 项还没齐，不建议直接进入大规模业务开发。

## 不建议延续到新项目的问题

README 已明确提到当前仓库还有历史包袱，新项目建议从一开始避免：

- `any` 过多，类型边界不清
- 页面承担过多流程控制
- 业务能力和展示逻辑耦合
- 临时逻辑散落在各个组件中

新项目应优先做到：

- 接口类型先定义
- 页面薄、store 稳定
- 路由和权限入口集中
- 组件职责单一

## 新项目落地原则

如果后续要基于这套结构新建项目，默认按下面规则执行：

- 先定目录结构，再写业务代码
- 先定路由和页面骨架，再补组件
- 先封装请求层和接口层，再接页面数据
- 公共逻辑优先沉到 `common` / `store`
- 页面只保留页面本身的组织职责

一句话总结：

以 `Rspack + React + TypeScript + Ant Design + Zustand` 为基础，采用“入口清晰、页面分层、状态内聚、接口收口”的结构来启动新项目。

##注意事项

1. 尽量避免使用 export default
2. 尽量避免使用 import \* as xxx from 'xxx';
3. 更推荐使用箭头函数
4. 写css的时候多使用嵌套语法，不要用:global去覆盖样式
5. 样式使用组件默认样式，不要自己设计
6. 能从公共store获取的参数，就不要父子层层传递
