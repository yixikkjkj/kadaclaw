import fs from "node:fs";
import path from "node:path";

const REVIEW_WEIGHT = 1;
const QA_WEIGHT = 1.1;
const POSITIVE_KEYWORDS = ["不错", "好用", "喜欢", "推荐", "舒服", "好看", "值", "方便", "稳定", "透气", "支撑", "轻"];
const NEGATIVE_KEYWORDS = ["异味", "漏水", "开胶", "开裂", "质量差", "掉色", "闷脚", "偏硬", "偏小", "偏大", "慢", "问题"];
const SEVERE_KEYWORDS = ["异味", "漏水", "开胶", "开裂", "质量差", "掉色"];

const ASPECTS = {
  quality: {
    label: "质量做工",
    keywords: ["质量差", "做工差", "开胶", "开裂", "掉色", "异味", "毛刺"],
    recommendations: ["排查材料与生产一致性", "优先验证异味、开胶、开裂问题"],
  },
  size_fit: {
    label: "尺码版型",
    keywords: ["偏大", "偏小", "尺码", "宽脚", "夹脚", "版型"],
    recommendations: ["补充尺码建议", "在详情页增加脚型和尺码提示"],
  },
  comfort: {
    label: "舒适脚感",
    keywords: ["舒服", "舒适", "偏硬", "闷脚", "硌脚", "缓震", "脚感"],
    recommendations: ["优化脚感和透气信息表达", "验证不同使用场景的舒适度反馈"],
  },
  function: {
    label: "功能表现",
    keywords: ["支撑", "稳定", "耐磨", "透气", "防滑", "缓震", "回弹"],
    recommendations: ["保留高认可功能点", "明确功能边界，减少用户预期错配"],
  },
  appearance: {
    label: "外观颜值",
    keywords: ["颜值", "好看", "外观", "配色", "质感"],
    recommendations: ["强化高认可外观卖点", "在主图延续用户认可的设计元素"],
  },
  value: {
    label: "价格价值",
    keywords: ["性价比", "值", "不值", "价格", "贵"],
    recommendations: ["优化价格与卖点的对应说明", "明确高价支撑点"],
  },
};

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

const addWeightedCount = (map, key, amount) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const topEntries = (counts, limit = 6) =>
  [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([keyword, weight]) => ({ keyword, weight: Number(weight.toFixed(1)) }));

const extractAspectHits = (text) => {
  const hits = [];
  Object.entries(ASPECTS).forEach(([key, config]) => {
    if (config.keywords.some((keyword) => text.includes(keyword))) {
      hits.push(key);
    }
  });
  return hits;
};

const collectCounts = (texts, keywords, weight) => {
  const counts = new Map();
  texts.forEach((text) => {
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        addWeightedCount(counts, keyword, weight);
      }
    });
  });
  return counts;
};

const mergeMaps = (...maps) => {
  const merged = new Map();
  maps.forEach((current) => {
    current.forEach((weight, key) => {
      addWeightedCount(merged, key, weight);
    });
  });
  return merged;
};

const riskLevelFromScore = (score) => {
  if (score >= 12) {
    return "high";
  }
  if (score >= 6) {
    return "medium";
  }
  return "low";
};

const buildProductAnalysis = (productData) => {
  const reviews = Array.isArray(productData.reviews) ? productData.reviews : [];
  const qa = Array.isArray(productData.qa) ? productData.qa : [];
  const reviewTexts = reviews.map((item) => normalizeText(item.content));
  const qaTexts = qa.map((item) => normalizeText(`${item.question || ""} ${item.answer || ""}`));
  const reviewPositive = collectCounts(reviewTexts, POSITIVE_KEYWORDS, REVIEW_WEIGHT);
  const reviewNegative = collectCounts(reviewTexts, NEGATIVE_KEYWORDS, REVIEW_WEIGHT);
  const reviewSevere = collectCounts(reviewTexts, SEVERE_KEYWORDS, REVIEW_WEIGHT);
  const qaPositive = collectCounts(qaTexts, POSITIVE_KEYWORDS, QA_WEIGHT);
  const qaNegative = collectCounts(qaTexts, NEGATIVE_KEYWORDS, QA_WEIGHT);
  const qaSevere = collectCounts(qaTexts, SEVERE_KEYWORDS, QA_WEIGHT);
  const mergedPositive = mergeMaps(reviewPositive, qaPositive);
  const mergedNegative = mergeMaps(reviewNegative, qaNegative);
  const mergedSevere = mergeMaps(reviewSevere, qaSevere);

  const aspectWeights = new Map();
  [...reviewTexts, ...qaTexts].forEach((text, index) => {
    const weight = index < reviewTexts.length ? REVIEW_WEIGHT : QA_WEIGHT;
    extractAspectHits(text).forEach((aspect) => addWeightedCount(aspectWeights, aspect, weight));
  });

  const rankedAspects = [...aspectWeights.entries()]
    .map(([key, weight]) => ({ key, label: ASPECTS[key].label, weight: Number(weight.toFixed(1)) }))
    .sort((left, right) => right.weight - left.weight);

  const topPositives = topEntries(mergedPositive, 5);
  const topNegatives = topEntries(mergedNegative, 6);
  const severeIssues = topEntries(mergedSevere, 5);
  const riskScore =
    severeIssues.reduce((total, item) => total + item.weight * 2, 0) +
    topNegatives.reduce((total, item) => total + item.weight, 0);

  return {
    pageUrl: productData.pageUrl || "",
    product: {
      title: normalizeText(productData.product?.title),
      priceText: normalizeText(productData.product?.priceText),
      salesText: normalizeText(productData.product?.salesText),
      highlights: Array.isArray(productData.product?.highlights) ? productData.product.highlights : [],
    },
    counts: {
      reviews: reviews.length,
      qa: qa.length,
    },
    risk: {
      score: Number(riskScore.toFixed(1)),
      level: riskLevelFromScore(riskScore),
    },
    topPositives,
    topNegatives,
    severeIssues,
    priorities: rankedAspects,
    representativeVoice: {
      reviews: reviewTexts.slice(0, 3),
      qa: qaTexts.slice(0, 3),
    },
    recommendations: rankedAspects.slice(0, 3).map((entry, index) => ({
      priority: index + 1,
      aspect: entry.label,
      actions: ASPECTS[entry.key].recommendations,
    })),
    summary:
      severeIssues.length > 0
        ? `当前商品已出现明确高风险问题，重点集中在 ${severeIssues.map((item) => item.keyword).join("、")}。`
        : `当前商品以常规体验问题为主，主要关注 ${topNegatives.map((item) => item.keyword).join("、") || "暂无明显高频问题"}。`,
  };
};

const buildCrossProductSummary = (products) => {
  const issueCounts = new Map();
  const positiveCounts = new Map();
  products.forEach((product) => {
    product.topNegatives.forEach((item) => addWeightedCount(issueCounts, item.keyword, item.weight));
    product.topPositives.forEach((item) => addWeightedCount(positiveCounts, item.keyword, item.weight));
  });

  const rankedProducts = [...products]
    .sort((left, right) => right.risk.score - left.risk.score)
    .map((product, index) => ({
      rank: index + 1,
      title: product.product.title || `商品 ${index + 1}`,
      riskLevel: product.risk.level,
      riskScore: product.risk.score,
      pageUrl: product.pageUrl,
    }));

  return {
    totalProducts: products.length,
    rankedProducts,
    commonIssues: topEntries(issueCounts, 8),
    commonPositives: topEntries(positiveCounts, 6),
    priorityProducts: rankedProducts.filter((item) => item.riskLevel !== "low").slice(0, 5),
  };
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/product-link-voc-analyzer/scripts/analyze-product-link-voc.mjs --input <collected-products-json> --output <analysis-json>",
    );
    process.exit(1);
  }

  const collected = loadJsonArray(inputPath);
  const products = collected.map(buildProductAnalysis);
  const analysis = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    products,
    summary: buildCrossProductSummary(products),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(analysis, null, 2));
};

main();
