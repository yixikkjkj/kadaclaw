export type SkillCategory = "工作流" | "开发" | "内容" | "自动化" | "团队";

export interface SkillMetric {
  label: string;
  value: string;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  summary: string;
  description: string;
  author: string;
  downloads: string;
  rating: number;
  tags: string[];
  metrics: SkillMetric[];
  compatibility: string[];
  updatedAt: string;
  installed?: boolean;
  featured?: boolean;
}

export const skillCategories = [
  "全部",
  "工作流",
  "开发",
  "内容",
  "自动化",
  "团队",
] as const;

export const skills: Skill[] = [
  {
    id: "deep-research",
    name: "深度研究",
    category: "工作流",
    summary: "多轮检索、引用整理、结构化输出，适合分析类任务。",
    description:
      "把问题拆分、资料检索、证据归档和结论整理整合成单一技能流程，适合中文研究、竞品分析、行业报告和高密度信息任务。",
    author: "OpenClaw Labs",
    downloads: "12.4k",
    rating: 4.9,
    tags: ["报告", "检索", "引用"],
    metrics: [
      { label: "平均时长", value: "4.8 分钟" },
      { label: "结构化输出", value: "92%" },
      { label: "满意度", value: "98%" },
    ],
    compatibility: ["OpenClaw 0.9+", "本地文件", "浏览器检索"],
    updatedAt: "2026-03-18",
    installed: true,
    featured: true,
  },
  {
    id: "repo-auditor",
    name: "代码库审计",
    category: "开发",
    summary: "扫描代码风险、依赖问题与关键实现路径，生成审查结论。",
    description:
      "面向工程团队的审计技能，聚合依赖清单、目录结构分析、风险提示和审查模板，适合接手新仓库或做发布前检查。",
    author: "Kada Team",
    downloads: "8.1k",
    rating: 4.8,
    tags: ["审计", "代码审查", "风险"],
    metrics: [
      { label: "支持仓库", value: "Monorepo / 单仓" },
      { label: "覆盖语言", value: "12 种" },
      { label: "典型输出", value: "审查报告" },
    ],
    compatibility: ["Git 仓库", "本地命令", "Markdown"],
    updatedAt: "2026-03-15",
    installed: true,
  },
  {
    id: "prompt-studio",
    name: "提示词工坊",
    category: "内容",
    summary: "面向中文团队的提示词版本管理、对比实验与模板复用。",
    description:
      "强调中文场景沉淀，把不同角色、不同模型和不同语气下的提示模板固化下来，便于团队协作和版本对照。",
    author: "Moonstack",
    downloads: "6.5k",
    rating: 4.7,
    tags: ["Prompt", "模板", "A/B"],
    metrics: [
      { label: "模板空间", value: "团队共享" },
      { label: "实验模式", value: "双路对比" },
      { label: "适用对象", value: "运营 / 产品 / 客服" },
    ],
    compatibility: ["OpenClaw 0.9+", "知识库", "表单输入"],
    updatedAt: "2026-03-09",
    featured: true,
  },
  {
    id: "release-agent",
    name: "发布助手",
    category: "自动化",
    summary: "串联 changelog、版本标记、测试清单与发布说明。",
    description:
      "用于产品上线前的收口动作，把测试项、版本说明、发布公告和回滚方案聚合在同一个工作流内。",
    author: "ShipFast CN",
    downloads: "5.2k",
    rating: 4.6,
    tags: ["CI", "发布", "版本"],
    metrics: [
      { label: "产物", value: "变更日志" },
      { label: "适配流程", value: "灰度 / 正式" },
      { label: "团队角色", value: "研发 / QA / 运营" },
    ],
    compatibility: ["Git", "CI", "Markdown"],
    updatedAt: "2026-03-12",
  },
  {
    id: "support-hub",
    name: "客服中台",
    category: "团队",
    summary: "聚合工单、FAQ 与话术库，帮助团队统一服务响应质量。",
    description:
      "围绕客服协同构建，把问题分类、答案模板、升级处理和追踪状态统一到一个技能里，适合中文服务团队。",
    author: "Tidal Works",
    downloads: "9.3k",
    rating: 4.8,
    tags: ["客服", "知识库", "协作"],
    metrics: [
      { label: "平均节省", value: "31% 响应时间" },
      { label: "知识库联动", value: "支持" },
      { label: "适配团队", value: "售后 / 客服" },
    ],
    compatibility: ["知识库", "工单", "团队空间"],
    updatedAt: "2026-03-20",
  },
  {
    id: "content-chain",
    name: "内容流水线",
    category: "内容",
    summary: "把选题、写作、润色、分发编排成统一流程。",
    description:
      "面向内容团队的端到端流水线，把日历、选题会、写作模板和分发渠道串起来，适合公众号、视频号、博客等渠道。",
    author: "Studio Helix",
    downloads: "7.4k",
    rating: 4.5,
    tags: ["写作", "分发", "运营"],
    metrics: [
      { label: "链路", value: "选题到分发" },
      { label: "支持渠道", value: "5+" },
      { label: "协作模式", value: "团队看板" },
    ],
    compatibility: ["日历", "知识库", "社媒文案"],
    updatedAt: "2026-03-11",
  },
];
