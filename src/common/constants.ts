export const ROUTE_PATHS = {
  workspace: "/workspace",
  market: "/market",
  installed: "/installed",
  settings: "/settings",
} as const;

export type AppRoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

export interface ActivityRecord {
  id: string;
  title: string;
  skillName: string;
  status: "成功" | "运行中" | "需处理";
  updatedAt: string;
  owner: string;
}

export interface MarketSource {
  id: string;
  name: string;
  scope: string;
  sync: string;
  status: "在线" | "离线";
}

export const activityRecords: ActivityRecord[] = [
  {
    id: "act-1",
    title: "新能源行业分析草案",
    skillName: "深度研究",
    status: "成功",
    updatedAt: "今天 14:20",
    owner: "产品策略组",
  },
  {
    id: "act-2",
    title: "客户端仓库发布前检查",
    skillName: "代码库审计",
    status: "运行中",
    updatedAt: "今天 13:42",
    owner: "桌面端工程",
  },
  {
    id: "act-3",
    title: "四月活动选题排期",
    skillName: "内容流水线",
    status: "需处理",
    updatedAt: "昨天 18:10",
    owner: "内容运营",
  },
];

export const marketSources: MarketSource[] = [
  {
    id: "source-clawhub",
    name: "ClawHub 官方源",
    scope: "公开技能",
    sync: "实时拉取",
    status: "在线",
  },
  {
    id: "source-local",
    name: "Kadaclaw 本地托管目录",
    scope: "已安装技能",
    sync: "按需刷新",
    status: "在线",
  },
];
