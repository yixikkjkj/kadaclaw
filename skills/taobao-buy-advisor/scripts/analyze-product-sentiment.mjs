import fs from "node:fs";
import path from "node:path";

const POSITIVE_KEYWORDS = [
  "好用",
  "不错",
  "喜欢",
  "推荐",
  "方便",
  "保温好",
  "做工不错",
  "质量不错",
  "颜值高",
  "值",
  "实用",
  "舒服",
  "清洗方便",
  "安装简单",
];

const NEGATIVE_KEYWORDS = [
  "异味",
  "漏水",
  "做工差",
  "质量差",
  "掉色",
  "假货",
  "不耐用",
  "容易坏",
  "尺寸不符",
  "偏小",
  "偏大",
  "闷热",
  "噪音",
  "发热",
  "卡顿",
  "割手",
  "毛刺",
  "退货",
  "退款",
  "漏发",
  "开裂",
  "密封圈",
];

const SEVERE_KEYWORDS = [
  "异味",
  "漏水",
  "做工差",
  "质量差",
  "假货",
  "容易坏",
  "开裂",
  "掉色",
  "发热",
  "毛刺",
];

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

const loadJson = (inputPath) => JSON.parse(fs.readFileSync(inputPath, "utf8"));

const countMatches = (texts, keywords) => {
  const counts = new Map();
  texts.forEach((text) => {
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
      }
    });
  });
  return counts;
};

const mergeCountMaps = (...maps) => {
  const merged = new Map();
  maps.forEach((current) => {
    current.forEach((count, keyword) => {
      merged.set(keyword, (merged.get(keyword) ?? 0) + count);
    });
  });
  return merged;
};

const parsePriceValue = (priceText) => {
  const match = normalizeText(priceText).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

const collectReviewSignals = (reviews) => {
  const texts = reviews.map((review) => normalizeText(review.content));
  const positiveCounts = countMatches(texts, POSITIVE_KEYWORDS);
  const negativeCounts = countMatches(texts, NEGATIVE_KEYWORDS);
  const severeCounts = countMatches(texts, SEVERE_KEYWORDS);

  const lowRatings = reviews.filter((review) => typeof review.rating === "number" && review.rating <= 2).length;
  const highRatings = reviews.filter((review) => typeof review.rating === "number" && review.rating >= 4).length;

  return {
    texts,
    positiveCounts,
    negativeCounts,
    severeCounts,
    lowRatings,
    highRatings,
  };
};

const collectQaSignals = (qa) => {
  const combinedTexts = qa.map((item) => normalizeText(`${item.question || ""} ${item.answer || ""}`));
  return {
    texts: combinedTexts,
    negativeCounts: countMatches(combinedTexts, NEGATIVE_KEYWORDS),
    positiveCounts: countMatches(combinedTexts, POSITIVE_KEYWORDS),
    severeCounts: countMatches(combinedTexts, SEVERE_KEYWORDS),
  };
};

const topEntries = (counts, limit = 6) =>
  [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));

const scoreReviewQuality = (reviewCount, lowRatings, highRatings) => {
  if (reviewCount === 0) {
    return 18;
  }
  const raw = 35 + (highRatings / reviewCount) * 10 - (lowRatings / reviewCount) * 25;
  return Math.max(0, Math.min(35, Math.round(raw)));
};

const scoreSevereIssues = (severeIssueCount) => Math.max(0, 25 - severeIssueCount * 6);

const scoreQaClarity = (qaCount, qaSevereCount, qaPositiveCount) => {
  const base = qaCount === 0 ? 10 : 14;
  const score = base + Math.min(6, qaPositiveCount) - Math.min(12, qaSevereCount * 3);
  return Math.max(0, Math.min(20, score));
};

const scorePriceFit = (priceValue, severeIssueCount, repeatedIssueCount) => {
  if (priceValue === null) {
    return Math.max(6, 14 - severeIssueCount * 2 - repeatedIssueCount);
  }

  let base = 16;
  if (priceValue >= 300) {
    base = 12;
  } else if (priceValue <= 50) {
    base = 18;
  }

  const score = base - severeIssueCount * 2 - repeatedIssueCount;
  return Math.max(0, Math.min(20, score));
};

const verdictFromScore = (score) => {
  if (score >= 75) {
    return "值得买";
  }
  if (score >= 60) {
    return "谨慎买";
  }
  return "不推荐";
};

const summarizeAudience = (issues, strengths) => {
  const suitable = [];
  const avoid = [];

  if (strengths.some((item) => /方便|简单|轻便|容量|颜值|保温/.test(item.keyword))) {
    suitable.push("更适合看重日常使用体验、便携性或基础功能的人");
  }
  if (strengths.some((item) => /性价比|值/.test(item.keyword))) {
    suitable.push("更适合预算有限、优先看性价比的人");
  }
  if (issues.some((item) => /漏水|开裂|质量差|假货/.test(item.keyword))) {
    avoid.push("不适合对稳定性、密封性或耐用性要求很高的人");
  }
  if (issues.some((item) => /异味|毛刺|掉色/.test(item.keyword))) {
    avoid.push("不适合对材质安全感或细节做工敏感的人");
  }

  if (suitable.length === 0) {
    suitable.push("适合需求明确、能接受少量小问题的普通买家");
  }
  if (avoid.length === 0) {
    avoid.push("不适合希望完全零瑕疵、且对评论样本不确定性容忍度低的人");
  }

  return { suitable, avoid };
};

const buildBottomLine = (verdict, strengths, issues, reviewCount, qaCount) => {
  const parts = [];
  parts.push(`基于当前可见的 ${reviewCount} 条评论和 ${qaCount} 条问答，这个商品整体判断为“${verdict}”。`);

  if (strengths.length > 0) {
    parts.push(`主要优点集中在 ${strengths.slice(0, 2).map((item) => item.keyword).join("、")}。`);
  }
  if (issues.length > 0) {
    parts.push(`主要风险集中在 ${issues.slice(0, 2).map((item) => item.keyword).join("、")}。`);
  }

  if (reviewCount < 8) {
    parts.push("可见样本偏少，结论更适合作为初筛，不适合当成绝对判断。");
  }

  return parts.join("");
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/taobao-buy-advisor/scripts/analyze-product-sentiment.mjs --input <product-json> --output <analysis-json>",
    );
    process.exit(1);
  }

  const data = loadJson(inputPath);
  const product = data.product ?? {};
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const qa = Array.isArray(data.qa) ? data.qa : [];

  const reviewSignals = collectReviewSignals(reviews);
  const qaSignals = collectQaSignals(qa);
  const mergedPositiveCounts = mergeCountMaps(reviewSignals.positiveCounts, qaSignals.positiveCounts);
  const mergedNegativeCounts = mergeCountMaps(reviewSignals.negativeCounts, qaSignals.negativeCounts);
  const mergedSevereCounts = mergeCountMaps(reviewSignals.severeCounts, qaSignals.severeCounts);
  const topStrengths = topEntries(mergedPositiveCounts, 5);
  const repeatedIssues = topEntries(mergedNegativeCounts, 8);

  const severeIssueCount = topEntries(mergedSevereCounts, 10).reduce((total, item) => total + item.count, 0);
  const reviewQualityScore = scoreReviewQuality(reviews.length, reviewSignals.lowRatings, reviewSignals.highRatings);
  const severeIssueScore = scoreSevereIssues(severeIssueCount);
  const qaScore = scoreQaClarity(
    qa.length,
    topEntries(qaSignals.severeCounts, 10).reduce((total, item) => total + item.count, 0),
    topEntries(qaSignals.positiveCounts, 10).reduce((total, item) => total + item.count, 0),
  );
  const priceScore = scorePriceFit(parsePriceValue(product.priceText), severeIssueCount, repeatedIssues.length);
  const totalScore = reviewQualityScore + severeIssueScore + qaScore + priceScore;
  const verdict = verdictFromScore(totalScore);
  const audience = summarizeAudience(repeatedIssues, topStrengths);

  const analysis = {
    pageUrl: data.pageUrl || "",
    product: {
      title: normalizeText(product.title),
      priceText: normalizeText(product.priceText),
      salesText: normalizeText(product.salesText),
      highlights: Array.isArray(product.highlights) ? product.highlights : [],
    },
    counts: {
      reviews: reviews.length,
      qa: qa.length,
    },
    score: {
      total: totalScore,
      verdict,
      dimensions: {
        reviewQuality: reviewQualityScore,
        severeIssues: severeIssueScore,
        qaClarity: qaScore,
        priceFit: priceScore,
      },
    },
    strengths: topStrengths,
    issues: repeatedIssues.slice(0, 8),
    qaSignals: {
      risks: topEntries(qaSignals.negativeCounts, 5),
      positives: topEntries(qaSignals.positiveCounts, 5),
    },
    ratingSignals: {
      lowRatings: reviewSignals.lowRatings,
      highRatings: reviewSignals.highRatings,
    },
    audience,
    bottomLine: buildBottomLine(verdict, topStrengths, repeatedIssues, reviews.length, qa.length),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(analysis, null, 2));
};

main();
