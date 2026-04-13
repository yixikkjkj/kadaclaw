import fs from "node:fs";
import path from "node:path";

const SOURCE_WEIGHTS = {
  review: 1,
  qa: 1.1,
  complaint: 2.5,
};

const ASPECTS = {
  quality: {
    label: "质量做工",
    keywords: ["质量差", "做工差", "开胶", "开裂", "掉色", "异味", "毛刺", "耐用", "胶水味", "做工一般"],
    recommendations: ["优化材料与做工一致性", "重点排查来料和生产端异味、开胶、开裂问题"],
  },
  size_fit: {
    label: "尺码版型",
    keywords: ["偏大", "偏小", "尺码", "宽脚", "夹脚", "版型"],
    recommendations: ["重做尺码提示与脚型建议", "在详情页增加不同脚型的选码说明"],
  },
  comfort: {
    label: "舒适脚感",
    keywords: ["舒服", "舒适", "偏硬", "闷脚", "硌脚", "缓震", "脚感"],
    recommendations: ["优化鞋面透气和中底脚感", "区分日常穿着和高强度场景的体验描述"],
  },
  function: {
    label: "功能表现",
    keywords: ["漏水", "保温", "防滑", "支撑", "稳定", "耐磨", "功能", "密封"],
    recommendations: ["对关键功能做专项验证", "把功能限制写清楚，降低预期错配"],
  },
  appearance: {
    label: "外观颜值",
    keywords: ["颜值", "好看", "外观", "配色", "质感"],
    recommendations: ["保留高好评外观元素", "在主图和详情页强化高认可外观卖点"],
  },
  packaging_logistics: {
    label: "包装物流",
    keywords: ["包装", "破损", "发货", "物流", "慢"],
    recommendations: ["优化包装保护", "缩短发货时效并加强异常物流预警"],
  },
  service: {
    label: "客服售后",
    keywords: ["客服", "售后", "退货", "退款", "处理慢", "回复慢"],
    recommendations: ["优化售后处理SOP", "加强客服针对高频问题的话术和响应时效"],
  },
  value: {
    label: "价格价值",
    keywords: ["性价比", "值", "不值", "价格", "贵"],
    recommendations: ["重做价格锚点和价值说明", "拆清楚高价对应的核心卖点"],
  },
};

const POSITIVE_KEYWORDS = ["不错", "好用", "喜欢", "推荐", "舒服", "好看", "值", "方便", "稳定", "保温好"];
const NEGATIVE_KEYWORDS = ["差", "问题", "退货", "退款", "异味", "漏水", "开胶", "开裂", "闷脚", "偏硬", "慢"];
const SEVERE_KEYWORDS = ["异味", "漏水", "开胶", "开裂", "质量差", "掉色", "退货", "退款"];

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
};

const normalizeText = (value) => `${value ?? ""}`.replace(/\s+/g, " ").trim();
const loadJsonArray = (inputPath) => {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Analysis input must be a JSON array.");
  }
  return parsed;
};

const sumBy = (items, selector) => items.reduce((total, item) => total + selector(item), 0);

const extractAspectHits = (text) => {
  const hits = [];
  Object.entries(ASPECTS).forEach(([key, config]) => {
    if (config.keywords.some((keyword) => text.includes(keyword))) {
      hits.push(key);
    }
  });
  return hits;
};

const scorePolarity = (text, source, rating) => {
  let score = 0;
  if (typeof rating === "number") {
    score += rating >= 4 ? 1 : rating <= 2 ? -1 : 0;
  }
  POSITIVE_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 1;
    }
  });
  NEGATIVE_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword)) {
      score -= 1;
    }
  });
  if (source === "complaint") {
    score -= 2;
  }
  return score;
};

const addWeightedCount = (map, key, amount) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const buildPriorityRecommendations = (rankedAspects) =>
  rankedAspects.slice(0, 4).map((entry, index) => ({
    priority: index + 1,
    aspect: entry.label,
    reason: `${entry.label}在多源消费者声音中反复出现，综合权重 ${entry.weight.toFixed(1)}`,
    actions: ASPECTS[entry.key].recommendations,
  }));

const pickRepresentativeVoice = (records, predicate, limit = 3) =>
  records
    .filter(predicate)
    .slice(0, limit)
    .map((record) => ({
      source: record.source,
      content: normalizeText(record.content).slice(0, 80),
    }));

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/product-voc-report/scripts/analyze-voc-data.mjs --input <json> --output <analysis-json>",
    );
    process.exit(1);
  }

  const records = loadJsonArray(inputPath).map((record) => ({
    ...record,
    content: normalizeText(record.content),
    replyContent: normalizeText(record.replyContent),
  }));

  const aspectWeights = new Map();
  const sourceBreakdown = new Map();
  const positiveCounts = new Map();
  const negativeCounts = new Map();
  const severeCounts = new Map();

  records.forEach((record) => {
    const sourceWeight = SOURCE_WEIGHTS[record.source] ?? 1;
    const text = normalizeText(`${record.content} ${record.replyContent}`);
    const aspectHits = extractAspectHits(text);
    const polarity = scorePolarity(text, record.source, record.rating);

    addWeightedCount(sourceBreakdown, record.source, 1);
    aspectHits.forEach((aspect) => {
      addWeightedCount(aspectWeights, aspect, sourceWeight);
    });

    POSITIVE_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword)) {
        addWeightedCount(positiveCounts, keyword, sourceWeight);
      }
    });
    NEGATIVE_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword)) {
        addWeightedCount(negativeCounts, keyword, sourceWeight);
      }
    });
    SEVERE_KEYWORDS.forEach((keyword) => {
      if (text.includes(keyword)) {
        addWeightedCount(severeCounts, keyword, sourceWeight);
      }
    });

    record.aspectHits = aspectHits;
    record.polarity = polarity;
  });

  const rankedAspects = [...aspectWeights.entries()]
    .map(([key, weight]) => ({ key, label: ASPECTS[key].label, weight }))
    .sort((left, right) => right.weight - left.weight);

  const topPositives = [...positiveCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([keyword, weight]) => ({ keyword, weight }));

  const topNegatives = [...negativeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([keyword, weight]) => ({ keyword, weight }));

  const severeIssues = [...severeCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([keyword, weight]) => ({ keyword, weight }));

  const analysis = {
    summary: {
      totalRecords: records.length,
      reviewCount: sourceBreakdown.get("review") ?? 0,
      qaCount: sourceBreakdown.get("qa") ?? 0,
      complaintCount: sourceBreakdown.get("complaint") ?? 0,
      sampleSizeLevel: records.length < 10 ? "small" : records.length < 50 ? "medium" : "large",
    },
    product: {
      itemId: records[0]?.itemId ?? "",
      itemTitle: records[0]?.itemTitle ?? "",
    },
    priorities: rankedAspects,
    topPositives,
    topNegatives,
    severeIssues,
    recommendations: buildPriorityRecommendations(rankedAspects),
    representativeVoice: {
      positive: pickRepresentativeVoice(records, (record) => record.polarity > 0),
      negative: pickRepresentativeVoice(records, (record) => record.polarity < 0),
      complaint: pickRepresentativeVoice(records, (record) => record.source === "complaint"),
    },
    sourceInsight: {
      reviewVsComplaintGap:
        (sourceBreakdown.get("complaint") ?? 0) > 0 && severeIssues.length > 0
          ? "投诉源已出现高风险信号，说明普通评价里未必完全暴露真实问题。"
          : "当前未看到明显的评价与投诉割裂。",
    },
    executiveSummary: {
      headline:
        severeIssues.length > 0
          ? "商品当前已出现明确的高风险消费者问题，建议优先处理产品和售后端的确定性问题。"
          : "商品整体反馈以常规体验问题为主，可优先优化高频细节问题。",
      keyPoint: rankedAspects
        .slice(0, 3)
        .map((entry) => entry.label)
        .join("、"),
      totalNegativeWeight: Number(sumBy(topNegatives, (item) => item.weight).toFixed(1)),
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(analysis, null, 2));
};

main();
