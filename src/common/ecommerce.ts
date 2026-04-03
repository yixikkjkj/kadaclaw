import { type BusinessObjectType, type CommercePlatform, type CommerceSceneKey, type CommerceTimeRange } from "~/types";

export const COMMERCE_PLATFORM_OPTIONS = [
  { label: "淘宝/天猫", value: "taobao", description: "偏搜索、评价和体验分运营" },
  { label: "抖音电商", value: "douyin", description: "偏内容、达人和直播转化" },
  { label: "拼多多", value: "pdd", description: "偏价格带、发货时效和售后效率" },
  { label: "京东", value: "jd", description: "偏履约服务、配送和售后体验" },
] as const satisfies readonly {
  label: string;
  value: CommercePlatform;
  description: string;
}[];

export const BUSINESS_OBJECT_OPTIONS = [
  { label: "商品", value: "product" },
  { label: "订单", value: "order" },
  { label: "售后单", value: "aftersales" },
  { label: "店铺", value: "shop" },
] as const satisfies readonly {
  label: string;
  value: BusinessObjectType;
}[];

export const TIME_RANGE_OPTIONS = [
  { label: "今日", value: "today" },
  { label: "近 7 天", value: "7d" },
  { label: "近 30 天", value: "30d" },
] as const satisfies readonly {
  label: string;
  value: CommerceTimeRange;
}[];

export interface CommerceSkillBlueprint {
  key: CommerceSceneKey;
  title: string;
  summary: string;
  category: string;
  platforms: string[];
  scenes: string[];
  requiredContexts: string[];
  examplePrompts: string[];
}

export const PRIMARY_SKILL_BLUEPRINTS: CommerceSkillBlueprint[] = [
  {
    key: "listing-copilot",
    title: "发品助手",
    summary: "生成标题、卖点和详情结构，帮商家把商品更快上架成可投放版本。",
    category: "发品增长",
    platforms: ["淘宝/天猫", "抖音电商", "拼多多", "京东"],
    scenes: ["新品发布", "标题优化", "详情页改写"],
    requiredContexts: ["平台", "商品标题", "类目", "卖点", "价格带"],
    examplePrompts: [
      "帮我把这款女装标题改成更适合拼多多搜索的版本",
      "把这款保温杯卖点整理成京东详情页结构",
    ],
  },
  {
    key: "aftersales-copilot",
    title: "售后处理助手",
    summary: "处理退款、退货、破损和物流异常，快速生成标准客服回复与处理建议。",
    category: "售后客服",
    platforms: ["淘宝/天猫", "抖音电商", "拼多多", "京东"],
    scenes: ["退款处理", "破损补发", "物流异常"],
    requiredContexts: ["平台", "订单号", "售后类型", "物流状态", "聊天记录"],
    examplePrompts: [
      "帮我回复一个用户说快递破损的售后单",
      "判断这笔退款是否建议直接通过并给客服一段回复",
    ],
  },
  {
    key: "store-review-copilot",
    title: "店铺复盘助手",
    summary: "按时间范围复盘流量、转化、售后和评分变化，给出下一步经营动作。",
    category: "经营复盘",
    platforms: ["淘宝/天猫", "抖音电商", "拼多多", "京东"],
    scenes: ["日报", "周报", "问题定位"],
    requiredContexts: ["平台", "时间范围", "订单摘要", "售后数据", "评分表现"],
    examplePrompts: [
      "复盘近 7 天店铺问题，告诉我先处理什么",
      "分析为什么最近退款率变高，并给 3 条动作建议",
    ],
  },
];

export const SECONDARY_SKILL_BLUEPRINTS: CommerceSkillBlueprint[] = [
  {
    key: "order-exception",
    title: "订单异常",
    summary: "识别揽收超时、物流停滞和缺货风险，给出优先级和沟通话术。",
    category: "履约服务",
    platforms: ["拼多多", "京东", "淘宝/天猫"],
    scenes: ["揽收超时", "物流停滞", "缺货预警"],
    requiredContexts: ["平台", "订单号", "物流状态"],
    examplePrompts: ["筛出今天最需要优先处理的异常订单"],
  },
  {
    key: "review-recovery",
    title: "评价修复",
    summary: "针对差评和低分评价生成补救策略、回复草稿和类似问题预防动作。",
    category: "服务口碑",
    platforms: ["淘宝/天猫", "抖音电商", "京东"],
    scenes: ["差评回复", "低分修复", "口碑预警"],
    requiredContexts: ["评价内容", "订单记录", "客服记录"],
    examplePrompts: ["这条差评怎么回复更稳妥"],
  },
  {
    key: "risk-inspector",
    title: "风险巡检",
    summary: "检查商品文案、活动表达和宣传语中的违规风险，给出替代表达。",
    category: "风险控制",
    platforms: ["淘宝/天猫", "抖音电商", "拼多多", "京东"],
    scenes: ["文案巡检", "活动审核", "宣传语整改"],
    requiredContexts: ["平台", "标题", "卖点", "活动文案"],
    examplePrompts: ["检查这段促销文案有没有平台风险"],
  },
];

export const QUICK_CHAT_PROMPTS = [
  "帮我优化这款商品标题",
  "帮我回复一个物流异常售后",
  "复盘近 7 天店铺问题",
] as const;

export const getCommercePlatformOption = (platform: CommercePlatform) =>
  COMMERCE_PLATFORM_OPTIONS.find((item) => item.value === platform) ?? COMMERCE_PLATFORM_OPTIONS[0];

export const getCommerceSceneBlueprint = (scene: CommerceSceneKey) =>
  PRIMARY_SKILL_BLUEPRINTS.find((item) => item.key === scene) ?? PRIMARY_SKILL_BLUEPRINTS[0];

export const getBusinessObjectOption = (target: BusinessObjectType) =>
  BUSINESS_OBJECT_OPTIONS.find((item) => item.value === target) ?? BUSINESS_OBJECT_OPTIONS[0];

export const getTimeRangeOption = (range: CommerceTimeRange) =>
  TIME_RANGE_OPTIONS.find((item) => item.value === range) ?? TIME_RANGE_OPTIONS[1];

export const buildCommercePromptPrefix = (params: {
  platform: CommercePlatform;
  scene: CommerceSceneKey;
  target: BusinessObjectType;
  range: CommerceTimeRange;
}) => {
  const platformOption = getCommercePlatformOption(params.platform);
  const sceneBlueprint = getCommerceSceneBlueprint(params.scene);
  const objectOption = getBusinessObjectOption(params.target);
  const rangeOption = getTimeRangeOption(params.range);

  return [
    `当前平台：${platformOption.label}`,
    `经营场景：${sceneBlueprint.title}`,
    `分析对象：${objectOption.label}`,
    `时间范围：${rangeOption.label}`,
    `请优先给出适合国内电商商家日常运营的可执行建议。`,
  ].join("\n");
};

export const buildCommercePlaceholder = (params: {
  platform: CommercePlatform;
  scene: CommerceSceneKey;
}) => {
  const platformOption = getCommercePlatformOption(params.platform);
  const sceneBlueprint = getCommerceSceneBlueprint(params.scene);

  return `在${platformOption.label}场景下提问，例如：${sceneBlueprint.examplePrompts[0]}`;
};

const SKILL_BLUEPRINTS = [...PRIMARY_SKILL_BLUEPRINTS, ...SECONDARY_SKILL_BLUEPRINTS];

const findBlueprintByText = (text: string) =>
  SKILL_BLUEPRINTS.find(
    (item) =>
      text.includes(item.key) ||
      text.includes(item.title) ||
      item.scenes.some((scene) => text.includes(scene)) ||
      item.category.includes(text),
  ) ?? null;

export const getSkillBlueprint = (params: { id?: string; name?: string; category?: string }) => {
  const byId = params.id ? findBlueprintByText(params.id) : null;
  if (byId) {
    return byId;
  }

  const byName = params.name ? findBlueprintByText(params.name) : null;
  if (byName) {
    return byName;
  }

  if (params.category) {
    return SKILL_BLUEPRINTS.find((item) => item.category.includes(params.category ?? "")) ?? null;
  }

  return null;
};
