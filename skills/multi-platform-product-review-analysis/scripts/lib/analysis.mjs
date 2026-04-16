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

const asPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

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

const normalizeRuntimeEvent = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return {
    type: normalizeText(entry.type),
    detail: normalizeText(entry.detail),
    timestamp: Number(entry.timestamp) || 0,
  };
};

const normalizeRuntimeDiagnostics = (value) => {
  const diagnostics = asPlainObject(value);
  const counters = asPlainObject(diagnostics.counters);
  const stages = asPlainObject(diagnostics.stages);

  return {
    status: normalizeText(diagnostics.status),
    issues: asArray(diagnostics.issues).map((item) => normalizeText(item)).filter(Boolean),
    stages,
    counters: {
      eventCount: Number(counters.eventCount) || 0,
      reviewNodeCount: Number(counters.reviewNodeCount) || 0,
      reviewSampleCount: Number(counters.reviewSampleCount) || 0,
      qaNodeCount: Number(counters.qaNodeCount) || 0,
      qaSampleCount: Number(counters.qaSampleCount) || 0,
    },
    recentEvents: asArray(diagnostics.recentEvents).map(normalizeRuntimeEvent).filter(Boolean),
    lastMatchedSelector: normalizeText(diagnostics.lastMatchedSelector),
    lastEvent: normalizeText(diagnostics.lastEvent),
    lastDetail: normalizeText(diagnostics.lastDetail),
  };
};

const normalizeTarget = (target) => {
  const reviews = asArray(target.reviews).map(normalizeReviewEntry).filter(Boolean);
  const qaPairs = asArray(target.qaPairs).map(normalizeQaEntry).filter(Boolean);

  return {
    platform: normalizeText(target.platform),
    productUrl: normalizeText(target.productUrl),
    reviews,
    qaPairs,
    reviewCount: reviews.length,
    qaCount: qaPairs.length,
    runtimeDiagnostics: normalizeRuntimeDiagnostics(target.runtimeDiagnostics),
  };
};

export const analyzePayload = (payload) => {
  const target = payload?.target;
  const context = payload?.context && typeof payload.context === "object" ? payload.context : {};

  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("输入缺少 target 对象。");
  }

  const normalizedTarget = normalizeTarget(target);

  return {
    target: normalizedTarget,
    context,
  };
};
