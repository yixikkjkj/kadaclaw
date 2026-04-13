const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

export const buildProductCollectScript = ({
  reviewLimit = 80,
  qaLimit = 40,
  scrollRounds = 6,
  scrollDelayMs = 1000,
} = {}) => {
  const script = `
const REVIEW_LIMIT = ${Number(reviewLimit)};
const QA_LIMIT = ${Number(qaLimit)};
const SCROLL_ROUNDS = ${Number(scrollRounds)};
const SCROLL_DELAY_MS = ${Number(scrollDelayMs)};

const normalizeText = (value) => (value ?? "").replace(/\\s+/g, " ").trim();
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitUntil = async (predicate, timeoutMs, intervalMs = 120) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await wait(intervalMs);
  }
  return predicate();
};

const pickText = (root, selectors) => {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const text = normalizeText(node?.textContent ?? "");
    if (text) {
      return text;
    }
  }
  return "";
};

const pickTexts = (root, selectors, limit = 10) => {
  for (const selector of selectors) {
    const texts = Array.from(root.querySelectorAll(selector))
      .map((node) => normalizeText(node.textContent ?? ""))
      .filter(Boolean)
      .slice(0, limit);
    if (texts.length > 0) {
      return texts;
    }
  }
  return [];
};

const clickByText = async (candidates, patterns) => {
  const nodes = Array.from(document.querySelectorAll(candidates));
  for (const node of nodes) {
    const text = normalizeText(node.textContent ?? "");
    if (patterns.some((pattern) => pattern.test(text))) {
      if (node instanceof HTMLElement) {
        node.click();
        await wait(1000);
        return true;
      }
    }
  }
  return false;
};

const scrollPage = async () => {
  let lastHeight = 0;
  for (let index = 0; index < SCROLL_ROUNDS; index += 1) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await wait(SCROLL_DELAY_MS);
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) {
      break;
    }
    lastHeight = height;
  }
};

const parseRating = (root) => {
  const text = normalizeText(root.textContent ?? "");
  if (/差评/.test(text)) {
    return 1;
  }
  if (/中评/.test(text)) {
    return 3;
  }
  if (/好评/.test(text)) {
    return 5;
  }

  const stars = root.querySelectorAll(
    ".star-full,.star-active,.icon-star.active,.next-rate-star-full,[class*=star][class*=active]"
  ).length;
  if (stars > 0) {
    return stars;
  }

  return null;
};

const parseDateText = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  const normalized = text
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, " ")
    .replace(/\\//g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
};

const extractProduct = () => ({
  title: pickText(document, [
    "h1",
    ".tb-main-title",
    ".ItemHeader--mainTitle",
    "[class*=title]",
    "[data-testid*=title]"
  ]),
  priceText: pickText(document, [
    ".tb-rmb-num",
    ".Price--priceText",
    ".price",
    "[class*=priceText]",
    "[class*=price]"
  ]),
  salesText: pickText(document, [
    ".tm-ind-item.tm-count",
    ".sales",
    "[class*=sale]",
    "[class*=sales]"
  ]),
  highlights: pickTexts(document, [
    ".attributes li",
    ".item-desc li",
    ".skuItem",
    "[class*=highlight]",
    "[class*=tag]"
  ], 12)
});

const extractReviews = () => {
  const rows = Array.from(
    document.querySelectorAll([
      "[data-review-id]",
      "[data-rate-id]",
      ".rate-item",
      ".review-item",
      "[class*=reviewItem]",
      "[class*=rateItem]"
    ].join(","))
  ).filter((node) => normalizeText(node.textContent ?? "").length > 3);

  return rows.slice(0, REVIEW_LIMIT).map((root, index) => ({
    id: normalizeText(root.getAttribute("data-review-id") || root.getAttribute("data-rate-id") || "") || String(index + 1),
    rating: parseRating(root),
    content: pickText(root, [
      ".rate-content",
      ".review-content",
      ".content",
      ".comment",
      "[class*=content]"
    ]) || normalizeText(root.textContent ?? ""),
    createdAt: parseDateText(
      pickText(root, [
        ".date",
        ".time",
        ".created",
        "[class*=date]",
        "[class*=time]"
      ]),
    ),
    userName: pickText(root, [
      ".buyer-nick",
      ".user-name",
      ".nick",
      "[class*=buyer]",
      "[class*=nick]"
    ]),
    raw: {
      html: root.outerHTML.slice(0, 3000)
    }
  }));
};

const extractQa = () => {
  const rows = Array.from(
    document.querySelectorAll([
      "[data-qa-id]",
      ".question-item",
      ".qa-item",
      "[class*=questionItem]",
      "[class*=qaItem]"
    ].join(","))
  ).filter((node) => normalizeText(node.textContent ?? "").length > 3);

  return rows.slice(0, QA_LIMIT).map((root, index) => ({
    id: normalizeText(root.getAttribute("data-qa-id") || "") || String(index + 1),
    question: pickText(root, [
      ".question",
      ".ask",
      "[class*=question]",
      "[class*=ask]"
    ]) || normalizeText(root.textContent ?? ""),
    answer: pickText(root, [
      ".answer",
      ".reply",
      "[class*=answer]",
      "[class*=reply]"
    ]),
    raw: {
      html: root.outerHTML.slice(0, 3000)
    }
  }));
};

const collectSection = async (patterns) => {
  await clickByText("a,button,span,div,li", patterns);
  await wait(1200);
  await scrollPage();
};

const collect = async () => {
  await waitUntil(() => document.body && document.body.innerText.length > 100, 10000);
  const product = extractProduct();

  await collectSection([/评价/, /评论/, /累计评价/]);
  const reviews = extractReviews();

  await collectSection([/问大家/, /问答/, /商品问答/]);
  const qa = extractQa();

  return {
    source: "browser",
    pageUrl: window.location.href,
    collectedAt: new Date().toISOString(),
    product,
    reviews,
    qa
  };
};

return await collect();
`;

  return compactScript(script);
};
