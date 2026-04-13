const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const toJson = (value) => JSON.stringify(value);

export const buildReviewCollectScript = ({
  limit = 100,
  scrollRounds = 6,
  scrollDelayMs = 1000,
  maxPages = 5,
} = {}) => {
  const script = `
const LIMIT = ${Number(limit)};
const MAX_SCROLL_ROUNDS = ${Number(scrollRounds)};
const SCROLL_DELAY_MS = ${Number(scrollDelayMs)};
const MAX_PAGES = ${Number(maxPages)};

const ROW_SELECTOR = [
  "[data-review-id]",
  "[data-rate-id]",
  ".rate-item",
  ".review-item",
  ".rate-content",
  "tbody tr",
  ".next-table-row",
  "[class*=rate-item]",
  "[class*=review-item]"
].join(",");

const NEXT_PAGE_SELECTOR = [
  ".pagination-next:not(.disabled)",
  ".next-pagination-item.next:not(.next-disabled)",
  ".next-btn.next-medium.next-btn-normal.next-pagination-item.next",
  ".next-btn-helper[aria-label*=next]",
  "button[aria-label*=next]:not([disabled])",
  "a[aria-label*=next]:not([aria-disabled=true])",
  ".pagination .next a",
  ".next a"
].join(",");

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

const pickAllText = (root, selectors) => {
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    const texts = nodes.map((node) => normalizeText(node.textContent ?? "")).filter(Boolean);
    if (texts.length > 0) {
      return texts;
    }
  }
  return [];
};

const parseRating = (root) => {
  const text = pickText(root, [
    "[class*=result]",
    "[class*=level]",
    ".rate-result",
    ".review-level",
    ".score",
    "td",
  ]);

  if (/差评/.test(text)) {
    return 1;
  }
  if (/中评/.test(text)) {
    return 3;
  }
  if (/好评/.test(text)) {
    return 5;
  }

  const activeStars = root.querySelectorAll(
    ".star-full,.star-active,.icon-star.active,.next-rate-star-full,[class*=star][class*=active]",
  ).length;
  if (activeStars > 0) {
    return activeStars;
  }

  const styleCandidate = root.querySelector("[style*=width]");
  const widthText = styleCandidate?.getAttribute("style") ?? "";
  const match = widthText.match(/width\\s*:\\s*(\\d+)%/i);
  if (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.min(5, Math.round(value / 20)));
    }
  }

  return null;
};

const parseReplyStatus = (root) => {
  const replyText = pickText(root, [
    ".reply-content",
    ".seller-reply",
    ".reply",
    "[class*=reply]",
    "[data-role=reply]"
  ]);
  if (replyText) {
    return "replied";
  }

  const text = normalizeText(root.textContent ?? "");
  if (/未回复|待回复/.test(text)) {
    return "pending";
  }
  return "unknown";
};

const getRows = () =>
  Array.from(document.querySelectorAll(ROW_SELECTOR)).filter((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    const text = normalizeText(node.textContent ?? "");
    return text.length > 4;
  });

const buildRecord = (root, index) => {
  const text = normalizeText(root.textContent ?? "");
  const content = pickText(root, [
    ".rate-content",
    ".review-content",
    ".content",
    ".comment",
    "[class*=content]",
    "td:nth-child(2)",
    "td:nth-child(3)"
  ]);
  const itemTitle = pickText(root, [
    ".item-title",
    ".goods-title",
    ".title",
    ".tb-title",
    "a[title]",
    "[class*=title]",
    "td:first-child"
  ]);
  const userName = pickText(root, [
    ".buyer-nick",
    ".user-name",
    ".nick",
    "[class*=buyer]",
    "[class*=nick]"
  ]);
  const createdAt = parseDateText(
    pickText(root, [
      ".date",
      ".time",
      ".created",
      "[class*=date]",
      "[class*=time]",
      "td:last-child"
    ]),
  );
  const replyContent = pickText(root, [
    ".reply-content",
    ".seller-reply",
    ".reply",
    "[class*=reply]"
  ]);
  const itemIdMatch =
    (root.getAttribute("data-review-id") || root.getAttribute("data-rate-id") || "").match(/\\d+/) ||
    (itemTitle.match(/(\\d{8,})/) ?? null);

  if (!content && !itemTitle && !text) {
    return null;
  }

  return {
    id: normalizeText(root.getAttribute("data-review-id") || root.getAttribute("data-rate-id") || "") || String(index + 1),
    source: "review",
    channel: "browser",
    itemId: itemIdMatch?.[0] ?? "",
    itemTitle,
    content: content || text,
    rating: parseRating(root),
    createdAt,
    replyStatus: parseReplyStatus(root),
    replyContent,
    userName,
    raw: {
      html: root.outerHTML.slice(0, 4000),
      text,
      tags: pickAllText(root, [".tag", "[class*=tag]", ".meta span"]),
      pageUrl: window.location.href
    }
  };
};

const scrollPage = async () => {
  let lastHeight = 0;
  for (let index = 0; index < MAX_SCROLL_ROUNDS; index += 1) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await wait(SCROLL_DELAY_MS);
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) {
      break;
    }
    lastHeight = height;
  }
};

const clickNextPage = async () => {
  const next = document.querySelector(NEXT_PAGE_SELECTOR);
  if (!(next instanceof HTMLElement)) {
    return false;
  }
  const previousMarker = getRows().slice(0, 3).map((row) => normalizeText(row.textContent ?? "")).join("\\n");
  next.click();
  await waitUntil(() => {
    const currentMarker = getRows().slice(0, 3).map((row) => normalizeText(row.textContent ?? "")).join("\\n");
    return currentMarker && currentMarker !== previousMarker;
  }, 12000);
  await wait(1000);
  return true;
};

const collect = async () => {
  const items = [];
  const seen = new Set();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    await waitUntil(() => getRows().length > 0, 12000);
    await scrollPage();

    getRows().forEach((row, index) => {
      if (items.length >= LIMIT) {
        return;
      }
      const record = buildRecord(row, index);
      if (!record) {
        return;
      }
      const key = [record.id, record.itemTitle, record.content, record.createdAt].join("|");
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      items.push(record);
    });

    if (items.length >= LIMIT) {
      break;
    }

    const moved = await clickNextPage();
    if (!moved) {
      break;
    }
  }

  return {
    pageUrl: window.location.href,
    count: items.length,
    items
  };
};

return await collect();
`;

  return compactScript(script);
};
