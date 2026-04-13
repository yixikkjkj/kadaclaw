export const compactJson = (data) => JSON.stringify(data);

export const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const parseNumber = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const match = text.replaceAll(",", "").match(/(-?\d+(?:\.\d+)?)\s*([万千亿]?)/);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  const unit = match[2];
  const scaleMap = {
    "": 1,
    千: 1_000,
    万: 10_000,
    亿: 100_000_000,
  };

  return number * (scaleMap[unit] ?? 1);
};

export const parsePrice = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const numbers = [...text.replaceAll(",", "").matchAll(/\d+(?:\.\d+)?/g)].map((item) =>
    Number(item[0])
  );
  if (!numbers.length) {
    return null;
  }

  return numbers.length > 1
    ? numbers.reduce((sum, current) => sum + current, 0) / numbers.length
    : numbers[0];
};

export const splitTags = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  const parts = text.split(/[|,/，、;；\n]+/);
  const seen = new Set();
  const result = [];

  for (const part of parts) {
    const item = normalizeText(part);
    if (item && !seen.has(item)) {
      result.push(item);
      seen.add(item);
    }
  }

  return result;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const REVIEW_THEMES = [
  { key: "price", label: "价格/优惠", keywords: ["贵", "便宜", "划算", "性价比", "优惠", "券", "活动"] },
  { key: "quality", label: "质量/做工", keywords: ["质量", "做工", "材质", "品质", "正品", "假货", "破损", "耐用"] },
  { key: "performance", label: "效果/性能", keywords: ["效果", "性能", "流畅", "稳定", "降噪", "清晰", "续航", "好用"] },
  { key: "spec", label: "规格/尺寸", keywords: ["尺寸", "大小", "尺码", "容量", "规格", "颜色", "型号"] },
  { key: "delivery", label: "物流/发货", keywords: ["发货", "物流", "快递", "包装", "送达", "时效"] },
  { key: "service", label: "售后/客服", keywords: ["客服", "售后", "退货", "退款", "换货", "服务", "态度"] },
  { key: "usage", label: "安装/使用", keywords: ["安装", "使用", "教程", "操作", "连接", "兼容"] },
];

const POSITIVE_HINTS = ["满意", "喜欢", "推荐", "不错", "很好", "优秀", "划算", "值得", "方便", "清晰"];
const NEGATIVE_HINTS = ["差", "一般", "失望", "问题", "坏", "慢", "贵", "退货", "退款", "破损", "卡顿"];
const UNRESOLVED_QA_HINTS = ["不知道", "不清楚", "暂不", "没有", "未", "无法", "不支持"];

const percentGap = (base, other) => {
  if (!base || other == null) {
    return null;
  }
  return (other - base) / base;
};

const safeRatio = (numerator, denominator) => {
  if (numerator == null || !denominator) {
    return null;
  }
  return numerator / denominator;
};

const median = (values) => {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const summarizeTitle = (title) => (title.length <= 42 ? title : `${title.slice(0, 39)}...`);

const buildInsight = (id, title, severity, evidence, recommendation) => ({
  id,
  title,
  severity,
  evidence,
  recommendation,
});

const chooseSeverity = (gap, warning, critical) => {
  if (gap >= critical) {
    return "high";
  }
  if (gap >= warning) {
    return "medium";
  }
  return "low";
};

const buildItemMetrics = (item) => {
  const title = normalizeText(item.productTitle);
  const shopTags = splitTags(item.shopTags);
  const productTags = splitTags(item.productTags);
  const serviceTags = splitTags(item.serviceText);
  const couponTags = splitTags(item.couponText);
  const salesValue = parseNumber(item.salesText);
  const priceValue = parsePrice(item.price);
  const reviewCountValue = parseNumber(item.reviewCountText);
  const ratingValue = parseNumber(item.shopScoreText);
  const detailImageCountValue = parseNumber(item.detailImageCount);
  const detailTextLengthValue = parseNumber(item.detailTextLength);

  let trustScore = 0;
  for (const tag of [...shopTags, ...productTags, ...serviceTags]) {
    if (["旗舰", "官方", "品牌", "正品", "自营", "企业"].some((keyword) => tag.includes(keyword))) {
      trustScore += 1;
    }
  }

  let contentScore = title.length / 10;
  if (detailImageCountValue) {
    contentScore += Math.min(detailImageCountValue, 20) / 4;
  }
  if (detailTextLengthValue) {
    contentScore += Math.min(detailTextLengthValue, 600) / 120;
  }

  return {
    title,
    titleSummary: summarizeTitle(title),
    shopName: normalizeText(item.shopName),
    priceValue,
    salesValue,
    reviewCountValue,
    ratingValue,
    trustScore,
    promoScore: productTags.length + couponTags.length,
    contentScore: Math.round(contentScore * 100) / 100,
    shopTags: shopTags.join(" | "),
    productTags: productTags.join(" | "),
    serviceTags: serviceTags.join(" | "),
    couponTags: couponTags.join(" | "),
  };
};

const normalizeReviewEntry = (entry) => {
  if (typeof entry === "string") {
    return {
      text: normalizeText(entry),
      rating: "",
      tag: "",
      isNegative: false,
    };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return {
    text: normalizeText(entry.text),
    rating: normalizeText(entry.rating),
    tag: normalizeText(entry.tag),
    isNegative: Boolean(entry.isNegative),
  };
};

const normalizeQaEntry = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return {
    question: normalizeText(entry.question),
    answer: normalizeText(entry.answer),
  };
};

const collectThemes = (texts) => {
  const counts = new Map();

  for (const text of texts) {
    for (const theme of REVIEW_THEMES) {
      if (theme.keywords.some((keyword) => text.includes(keyword))) {
        counts.set(theme.label, (counts.get(theme.label) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([theme, count]) => ({ theme, count }));
};

const summarizeReviewSignals = (item) => {
  const reviews = asArray(item.reviews).map(normalizeReviewEntry).filter(Boolean);
  const texts = reviews.map((review) => review.text).filter(Boolean);
  const positiveTexts = texts.filter((text) =>
    POSITIVE_HINTS.some((keyword) => text.includes(keyword))
  );
  const negativeTexts = texts.filter((text) =>
    NEGATIVE_HINTS.some((keyword) => text.includes(keyword))
  );
  const taggedNegativeTexts = reviews
    .filter((review) => review.isNegative && review.text)
    .map((review) => review.text);
  const finalNegativeTexts = [...new Set([...negativeTexts, ...taggedNegativeTexts])];
  const positiveThemes = collectThemes(positiveTexts);
  const negativeThemes = collectThemes(finalNegativeTexts);

  return {
    reviews,
    reviewCount: reviews.length,
    negativeReviewCount: finalNegativeTexts.length,
    positiveReviewCount: positiveTexts.length,
    reviewThemeSummary: positiveThemes.map((item) => `${item.theme}:${item.count}`).join(" | "),
    complaintThemeSummary: negativeThemes.map((item) => `${item.theme}:${item.count}`).join(" | "),
    topReviewThemes: positiveThemes.slice(0, 3),
    topComplaintThemes: negativeThemes.slice(0, 3),
    positiveReviewSamples: positiveTexts.slice(0, 5),
    negativeReviewSamples: finalNegativeTexts.slice(0, 5),
  };
};

const summarizeQaSignals = (item) => {
  const qaPairs = asArray(item.qaPairs).map(normalizeQaEntry).filter(Boolean);
  const questionTexts = qaPairs.map((pair) => pair.question).filter(Boolean);
  const answerTexts = qaPairs.map((pair) => pair.answer).filter(Boolean);
  const unresolvedPairs = qaPairs.filter(
    (pair) =>
      !pair.answer || UNRESOLVED_QA_HINTS.some((keyword) => pair.answer.includes(keyword))
  );
  const questionThemes = collectThemes(questionTexts);
  const answerThemes = collectThemes(answerTexts);

  return {
    qaPairs,
    qaCount: qaPairs.length,
    unresolvedQaCount: unresolvedPairs.length,
    topQuestionThemes: questionThemes.slice(0, 3),
    topAnswerThemes: answerThemes.slice(0, 3),
    questionThemeSummary: questionThemes.map((item) => `${item.theme}:${item.count}`).join(" | "),
    unresolvedQaSamples: unresolvedPairs.slice(0, 5).map((pair) => ({
      question: pair.question,
      answer: pair.answer,
    })),
  };
};

const buildVoiceMetrics = (item) => {
  const reviewSignals = summarizeReviewSignals(item);
  const qaSignals = summarizeQaSignals(item);

  return {
    ...reviewSignals,
    ...qaSignals,
  };
};

export const analyzePayload = (payload) => {
  const target = payload?.target;
  const competitors = payload?.competitors;
  const context = payload?.context && typeof payload.context === "object" ? payload.context : {};

  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("输入缺少 target 对象。");
  }
  if (!Array.isArray(competitors)) {
    throw new Error("输入缺少 competitors 数组。");
  }

  const targetMetrics = buildItemMetrics(target);
  const targetVoiceMetrics = buildVoiceMetrics(target);
  const targetUrl = normalizeText(target.productUrl);
  const targetShop = normalizeText(target.shopName);

  const competitorRows = competitors
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .filter((item) => {
      const itemUrl = normalizeText(item.productUrl);
      const itemShop = normalizeText(item.shopName);
      if (itemUrl && itemUrl === targetUrl) {
        return false;
      }
      if (targetShop && itemShop === targetShop) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const metrics = buildItemMetrics(item);
      const voiceMetrics = buildVoiceMetrics(item);
      return {
        ...item,
        ...metrics,
        ...voiceMetrics,
        salesGapRatio: percentGap(targetMetrics.salesValue, metrics.salesValue),
        priceGapRatio: percentGap(targetMetrics.priceValue, metrics.priceValue),
        reviewGapRatio: percentGap(targetMetrics.reviewCountValue, metrics.reviewCountValue),
      };
    })
    .sort((left, right) => {
      const leftSales = left.salesValue ?? Number.NEGATIVE_INFINITY;
      const rightSales = right.salesValue ?? Number.NEGATIVE_INFINITY;
      if (leftSales !== rightSales) {
        return rightSales - leftSales;
      }
      const leftReviews = left.reviewCountValue ?? Number.NEGATIVE_INFINITY;
      const rightReviews = right.reviewCountValue ?? Number.NEGATIVE_INFINITY;
      return rightReviews - leftReviews;
    });

  const pickMetricValues = (key) =>
    competitorRows.map((row) => row[key]).filter((value) => typeof value === "number" && Number.isFinite(value));

  const salesValues = pickMetricValues("salesValue");
  const priceValues = pickMetricValues("priceValue");
  const reviewValues = pickMetricValues("reviewCountValue");
  const ratingValues = pickMetricValues("ratingValue");
  const trustValues = pickMetricValues("trustScore");
  const promoValues = pickMetricValues("promoScore");
  const contentValues = pickMetricValues("contentScore");
  const competitorReviewSampleCounts = pickMetricValues("reviewCount");
  const competitorNegativeReviewCounts = pickMetricValues("negativeReviewCount");
  const competitorQaCounts = pickMetricValues("qaCount");
  const competitorUnresolvedQaCounts = pickMetricValues("unresolvedQaCount");

  const insights = [];
  const targetPrice = targetMetrics.priceValue;
  const targetSales = targetMetrics.salesValue;
  const targetReviews = targetMetrics.reviewCountValue;
  const targetRating = targetMetrics.ratingValue;
  const targetTrust = targetMetrics.trustScore;
  const targetPromo = targetMetrics.promoScore;
  const targetContent = targetMetrics.contentScore;
  const targetReviewCount = targetVoiceMetrics.reviewCount;
  const targetNegativeReviewCount = targetVoiceMetrics.negativeReviewCount;
  const targetQaCount = targetVoiceMetrics.qaCount;
  const targetUnresolvedQaCount = targetVoiceMetrics.unresolvedQaCount;

  if (targetVoiceMetrics.topComplaintThemes.length) {
    insights.push(
      buildInsight(
        "review-complaints",
        "页面评价暴露出主要差评主题",
        "high",
        `目标链接高频差评主题：${targetVoiceMetrics.topComplaintThemes
          .map((item) => `${item.theme}(${item.count})`)
          .join("、")}。`,
        "优先围绕这些差评主题修改商品承诺、详情页说明、客服话术和履约流程。"
      )
    );
  }

  if (targetVoiceMetrics.topQuestionThemes.length) {
    insights.push(
      buildInsight(
        "qa-hot-topics",
        "页面问答集中暴露用户下单前顾虑",
        "medium",
        `目标链接高频问答主题：${targetVoiceMetrics.topQuestionThemes
          .map((item) => `${item.theme}(${item.count})`)
          .join("、")}。`,
        "把这些高频提问前置到主图卖点、详情页 FAQ 和客服快捷回复中，减少用户决策阻力。"
      )
    );
  }

  if (competitorReviewSampleCounts.length && targetReviewCount < median(competitorReviewSampleCounts)) {
    insights.push(
      buildInsight(
        "review-sample-gap",
        "目标链接可见评价内容弱于竞品",
        "medium",
        `目标可分析评价样本数约为 ${targetReviewCount}，竞品中位数约为 ${median(
          competitorReviewSampleCounts
        )}。`,
        "先补评价内容沉淀，特别是能解释使用效果、规格匹配和服务体验的真实评价。"
      )
    );
  }

  if (
    competitorNegativeReviewCounts.length &&
    median(competitorNegativeReviewCounts) != null &&
    targetNegativeReviewCount > median(competitorNegativeReviewCounts)
  ) {
    insights.push(
      buildInsight(
        "complaint-gap",
        "目标链接差评暴露的问题比竞品更集中",
        "high",
        `目标差评样本数约为 ${targetNegativeReviewCount}，竞品中位数约为 ${median(
          competitorNegativeReviewCounts
        )}。`,
        "优先处理反复出现的履约、质量或使用问题，再做流量和转化优化。"
      )
    );
  }

  if (competitorQaCounts.length && targetQaCount < median(competitorQaCounts)) {
    insights.push(
      buildInsight(
        "qa-coverage-gap",
        "目标链接问答覆盖度弱于竞品",
        "medium",
        `目标问答样本数约为 ${targetQaCount}，竞品中位数约为 ${median(
          competitorQaCounts
        )}。`,
        "增加用户最常问问题的标准答案，把关键规格、兼容性和使用条件说清楚。"
      )
    );
  }

  if (
    competitorUnresolvedQaCounts.length &&
    median(competitorUnresolvedQaCounts) != null &&
    targetUnresolvedQaCount > median(competitorUnresolvedQaCounts)
  ) {
    insights.push(
      buildInsight(
        "qa-unresolved-gap",
        "目标链接存在更多未被有效回答的提问",
        "high",
        `目标未解决问答约为 ${targetUnresolvedQaCount}，竞品中位数约为 ${median(
          competitorUnresolvedQaCounts
        )}。`,
        "优先补齐未答清的问题，避免用户在关键问题上离开页面或转向竞品。"
      )
    );
  }

  if (salesValues.length && targetSales != null) {
    const topSales = Math.max(...salesValues);
    const salesRatio = safeRatio(targetSales, topSales);
    if (salesRatio != null && salesRatio < 0.5) {
      insights.push(
        buildInsight(
          "sales-gap",
          "目标链接销量显著落后头部同款",
          chooseSeverity(1 - salesRatio, 0.5, 0.8),
          `目标销量约为 ${targetSales.toFixed(0)}，头部同款约为 ${topSales.toFixed(0)}，仅达到 ${(salesRatio * 100).toFixed(1)}%。`,
          "优先复盘价格、评价积累、店铺信任信号和促销权益，先缩小影响转化的显性差距。"
        )
      );
    }
  }

  if (priceValues.length && targetPrice != null) {
    const competitorMedianPrice = median(priceValues);
    if (competitorMedianPrice && targetPrice > competitorMedianPrice * 1.05) {
      const priceGap = (targetPrice - competitorMedianPrice) / competitorMedianPrice;
      insights.push(
        buildInsight(
          "price-gap",
          "目标链接价格高于主流竞品",
          chooseSeverity(priceGap, 0.08, 0.18),
          `目标价格约为 ${targetPrice.toFixed(2)}，竞品价格中位数约为 ${competitorMedianPrice.toFixed(2)}。`,
          "如果利润允许，优先测试更直接的价格带、满减券或赠品组合，而不是只改主图或详情页。"
        )
      );
    }
  }

  if (reviewValues.length && targetReviews != null) {
    const competitorMedianReviews = median(reviewValues);
    if (competitorMedianReviews && targetReviews < competitorMedianReviews * 0.7) {
      const reviewGap = 1 - targetReviews / competitorMedianReviews;
      insights.push(
        buildInsight(
          "review-gap",
          "目标链接评价沉淀偏弱",
          chooseSeverity(reviewGap, 0.25, 0.5),
          `目标评价量约为 ${targetReviews.toFixed(0)}，竞品中位数约为 ${competitorMedianReviews.toFixed(0)}。`,
          "优先补真实成交后的评价沉淀与买家秀素材，评价规模通常直接影响转化和平台分发。"
        )
      );
    }
  }

  if (ratingValues.length && targetRating != null) {
    const competitorMedianRating = median(ratingValues);
    if (competitorMedianRating != null && targetRating < competitorMedianRating) {
      const ratingGap = competitorMedianRating - targetRating;
      insights.push(
        buildInsight(
          "rating-gap",
          "店铺评分或综合口碑弱于竞品",
          chooseSeverity(ratingGap, 0.1, 0.3),
          `目标店铺评分约为 ${targetRating.toFixed(2)}，竞品中位数约为 ${competitorMedianRating.toFixed(2)}。`,
          "检查售后、物流时效和差评关键词，先修复影响下单信心的服务问题。"
        )
      );
    }
  }

  if (trustValues.length) {
    const medianTrust = median(trustValues);
    if (medianTrust != null && targetTrust < medianTrust) {
      insights.push(
        buildInsight(
          "trust-gap",
          "目标链接可见信任信号偏少",
          chooseSeverity(medianTrust - targetTrust, 1, 2),
          "竞品页面更常见旗舰、官方、品牌、自营或企业等信任标签。",
          "优先补齐店铺认证、品牌背书、正品承诺和页面可见的服务保障文案。"
        )
      );
    }
  }

  if (promoValues.length) {
    const medianPromo = median(promoValues);
    if (medianPromo != null && targetPromo < medianPromo) {
      insights.push(
        buildInsight(
          "promo-gap",
          "目标链接促销表达弱于竞品",
          chooseSeverity(medianPromo - targetPromo, 1, 3),
          "竞品在商品标签、券、满减或活动权益上的可见信息更多。",
          "补充平台券、凑单策略、限时优惠或赠品信息，让转化理由更直接。"
        )
      );
    }
  }

  if (contentValues.length) {
    const medianContent = median(contentValues);
    if (medianContent != null && targetContent < medianContent) {
      insights.push(
        buildInsight(
          "content-gap",
          "详情承接信息可能不足",
          chooseSeverity(medianContent - targetContent, 2, 5),
          "竞品标题长度、详情图数量或详情文字量更完整。",
          "补齐规格卖点、场景图、对比图和常见问题，减少用户跳失。"
        )
      );
    }
  }

  if (!insights.length) {
    insights.push(
        buildInsight(
          "limited-signal",
          "评价和问答信号不足，未发现单一决定性差距",
          "low",
          "当前采集到的评价和问答样本不足，暂未形成稳定结论。",
          "建议优先补采评价文本和问答内容，再用价格、服务和详情信号做辅助判断。"
        )
      );
  }

  return {
    summary: {
      platform: normalizeText(context.platform ?? target.platform),
      targetTitle: targetMetrics.titleSummary,
      targetShopName: targetMetrics.shopName,
      targetPrice,
      targetSales,
      targetReviewSampleCount: targetReviewCount,
      targetQaSampleCount: targetQaCount,
      competitorCount: competitorRows.length,
      topCompetitorSales: salesValues.length ? Math.max(...salesValues) : null,
      medianCompetitorPrice: median(priceValues),
      medianCompetitorReviews: median(reviewValues),
      insightCount: insights.length,
    },
    insights,
    target: {
      ...target,
      ...targetMetrics,
      ...targetVoiceMetrics,
    },
    competitors: competitorRows,
    context,
  };
};
