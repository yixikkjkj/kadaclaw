const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const buildSharedHelpers = () => `
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
const pickTexts = (root, selectors, limit = 20) => {
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
const getCellNodes = (root) => {
  const directCells = Array.from(root.children).filter((node) =>
    node.matches?.("td,th,[role=cell],[class*=cell],[class*=table-cell]"),
  );
  if (directCells.length > 0) {
    return directCells;
  }
  return Array.from(root.querySelectorAll(":scope > td, :scope > th, :scope > [role=cell], :scope > [class*=cell], :scope > [class*=table-cell]"));
};
const getTableContainer = (root) =>
  root.closest("table,[class*=table],[class*=Table],[role=table],.next-table,.ant-table,.el-table") || document;
const getHeaderTexts = (root) => {
  const container = getTableContainer(root);
  const headerNodes = Array.from(
    container.querySelectorAll(
      "thead th, thead td, [role=columnheader], .next-table-header th, .ant-table-thead th, .el-table__header th",
    ),
  );
  if (headerNodes.length > 0) {
    return headerNodes.map((node) => normalizeText(node.textContent ?? ""));
  }
  const firstRow = container.querySelector("tr");
  if (firstRow && firstRow !== root) {
    const maybeHeaders = getCellNodes(firstRow).map((node) => normalizeText(node.textContent ?? ""));
    if (maybeHeaders.some((text) => text.length > 0 && text.length < 20)) {
      return maybeHeaders;
    }
  }
  return [];
};
const findCellTextByHeader = (root, patterns) => {
  const headers = getHeaderTexts(root);
  const cells = getCellNodes(root);
  if (headers.length === 0 || cells.length === 0) {
    return "";
  }
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    if (patterns.some((pattern) => pattern.test(header))) {
      return normalizeText(cells[index]?.textContent ?? "");
    }
  }
  return "";
};
const getLabeledLines = (root) =>
  normalizeText(root.innerText ?? "")
    .split(/\\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
const findTextByLabel = (root, patterns) => {
  const lines = getLabeledLines(root);
  for (const line of lines) {
    for (const pattern of patterns) {
      if (!pattern.test(line)) {
        continue;
      }
      const value = line.replace(/^.*?[：:]/, "").trim();
      if (value && value !== line) {
        return value;
      }
    }
  }
  return "";
};
const findByHeaderOrLabel = (root, patterns) =>
  findCellTextByHeader(root, patterns) || findTextByLabel(root, patterns);
const getRowTextLines = (root) => getLabeledLines(root);
const findLongestMeaningfulText = (values) =>
  values
    .map((value) => normalizeText(value))
    .filter((value) => value && value.length > 3)
    .sort((left, right) => right.length - left.length)[0] || "";
const findPotentialTitle = (root) =>
  findLongestMeaningfulText([
    pickText(root, [".item-title", ".goods-title", ".title", "a[title]", "[class*=title]"]),
    findByHeaderOrLabel(root, [/商品/, /宝贝/, /货品/, /标题/, /商品信息/]),
    ...pickTexts(root, ["a[title]", "a", "[class*=title]"], 8),
  ]);
const findPotentialDate = (root) =>
  parseDateText(
    findByHeaderOrLabel(root, [/时间/, /日期/, /创建时间/, /评价时间/, /提问时间/, /申请时间/]) ||
      pickText(root, [".date", ".time", ".created", "[class*=date]", "[class*=time]"]),
  );
const extractFirstNumericId = (value) => {
  const match = normalizeText(value).match(/\\d{6,}/);
  return match?.[0] ?? "";
};
const findPotentialItemId = (root) =>
  extractFirstNumericId(
    [
      root.getAttribute("data-item-id"),
      root.getAttribute("data-goods-id"),
      root.getAttribute("data-id"),
      findByHeaderOrLabel(root, [/商品id/, /宝贝id/, /货品id/, /商品编号/, /货号/]),
      root.innerText,
    ].join(" "),
  );
const getTableRows = (selectors) =>
  Array.from(document.querySelectorAll(selectors)).filter((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    const text = normalizeText(node.innerText ?? node.textContent ?? "");
    return text.length > 4;
  });
const dedupePush = (items, seen, record, keys) => {
  const key = keys.map((keyName) => normalizeText(record[keyName] ?? "")).join("|");
  if (!key || seen.has(key)) {
    return;
  }
  seen.add(key);
  items.push(record);
};
const scrollPage = async (rounds, delayMs) => {
  let lastHeight = 0;
  for (let index = 0; index < rounds; index += 1) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await wait(delayMs);
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) {
      break;
    }
    lastHeight = height;
  }
};
const clickNextPage = async (selectors) => {
  const next = document.querySelector(selectors);
  if (!(next instanceof HTMLElement)) {
    return false;
  }
  const before = document.body.innerText.slice(0, 200);
  next.click();
  await waitUntil(() => document.body.innerText.slice(0, 200) !== before, 12000);
  await wait(1000);
  return true;
};
const clickTabByText = async (patterns) => {
  const nodes = Array.from(document.querySelectorAll("a,button,span,div,li"));
  for (const node of nodes) {
    const text = normalizeText(node.textContent ?? "");
    if (patterns.some((pattern) => pattern.test(text)) && node instanceof HTMLElement) {
      node.click();
      await wait(1000);
      return true;
    }
  }
  return false;
};
`;

export const buildReviewCollectScript = ({ limit = 120, scrollRounds = 6, scrollDelayMs = 900, maxPages = 5 } = {}) =>
  compactScript(`
${buildSharedHelpers()}
const LIMIT = ${Number(limit)};
const SCROLL_ROUNDS = ${Number(scrollRounds)};
const SCROLL_DELAY_MS = ${Number(scrollDelayMs)};
const MAX_PAGES = ${Number(maxPages)};
const ROW_SELECTOR = ["[data-review-id]", "[data-rate-id]", ".rate-item", ".review-item", "tbody tr", ".next-table-row", "[class*=review-item]", "[class*=rate-item]"].join(",");
const NEXT_SELECTOR = [".pagination-next:not(.disabled)", ".next-pagination-item.next:not(.next-disabled)", "button[aria-label*=next]:not([disabled])", "a[aria-label*=next]:not([aria-disabled=true])"].join(",");
const parseRating = (root) => {
  const text =
    findByHeaderOrLabel(root, [/评分/, /星级/, /评价等级/, /好评/, /中评/, /差评/]) ||
    normalizeText(root.textContent ?? "");
  if (/差评/.test(text)) return 1;
  if (/中评/.test(text)) return 3;
  if (/好评/.test(text)) return 5;
  const stars = root.querySelectorAll(".star-full,.star-active,.icon-star.active,[class*=star][class*=active]").length;
  return stars > 0 ? stars : null;
};
const buildRecord = (root, index) => {
  const text = normalizeText(root.innerText ?? root.textContent ?? "");
  if (!text) return null;
  const content =
    findByHeaderOrLabel(root, [/评价内容/, /评论内容/, /内容/, /反馈/, /买家评价/]) ||
    pickText(root, [".rate-content", ".review-content", ".content", ".comment", "[class*=content]", "td:nth-child(2)", "td:nth-child(3)"]) ||
    findLongestMeaningfulText(getRowTextLines(root));
  return {
    id: normalizeText(root.getAttribute("data-review-id") || root.getAttribute("data-rate-id") || "") || String(index + 1),
    source: "review",
    channel: "browser",
    itemId: findPotentialItemId(root),
    itemTitle: findPotentialTitle(root),
    content,
    replyContent:
      findByHeaderOrLabel(root, [/回复/, /商家回复/, /回评/, /解释/]) ||
      pickText(root, [".reply-content", ".seller-reply", ".reply", "[class*=reply]"]),
    rating: parseRating(root),
    createdAt: findPotentialDate(root),
    raw: { html: root.outerHTML.slice(0, 3000) }
  };
};
const collect = async () => {
  const items = [];
  const seen = new Set();
  await clickTabByText([/评价管理/, /评价/, /评论/]);
  for (let page = 0; page < MAX_PAGES; page += 1) {
    await waitUntil(() => getTableRows(ROW_SELECTOR).length > 0, 12000);
    await scrollPage(SCROLL_ROUNDS, SCROLL_DELAY_MS);
    getTableRows(ROW_SELECTOR).forEach((row, index) => {
      if (items.length >= LIMIT) return;
      const record = buildRecord(row, index);
      if (!record) return;
      dedupePush(items, seen, record, ["id", "itemTitle", "content", "createdAt"]);
    });
    if (items.length >= LIMIT) break;
    const moved = await clickNextPage(NEXT_SELECTOR);
    if (!moved) break;
  }
  return items;
};
return await collect();
`);

export const buildQaCollectScript = ({ limit = 120, scrollRounds = 6, scrollDelayMs = 900, maxPages = 5 } = {}) =>
  compactScript(`
${buildSharedHelpers()}
const LIMIT = ${Number(limit)};
const SCROLL_ROUNDS = ${Number(scrollRounds)};
const SCROLL_DELAY_MS = ${Number(scrollDelayMs)};
const MAX_PAGES = ${Number(maxPages)};
const ROW_SELECTOR = ["[data-qa-id]", ".question-item", ".qa-item", ".ask-item", ".next-table-row", "[class*=question-item]", "[class*=qa-item]"].join(",");
const NEXT_SELECTOR = [".pagination-next:not(.disabled)", ".next-pagination-item.next:not(.next-disabled)", "button[aria-label*=next]:not([disabled])", "a[aria-label*=next]:not([aria-disabled=true])"].join(",");
const buildRecord = (root, index) => {
  const text = normalizeText(root.innerText ?? root.textContent ?? "");
  if (!text) return null;
  const content =
    findByHeaderOrLabel(root, [/问题内容/, /提问/, /问题/, /问答内容/]) ||
    pickText(root, [".question", ".ask", "[class*=question]", "[class*=ask]", "td:nth-child(2)"]) ||
    findLongestMeaningfulText(getRowTextLines(root));
  return {
    id: normalizeText(root.getAttribute("data-qa-id") || "") || String(index + 1),
    source: "qa",
    channel: "browser",
    itemId: findPotentialItemId(root),
    itemTitle: findPotentialTitle(root),
    content,
    replyContent:
      findByHeaderOrLabel(root, [/回答/, /回复/, /商家回复/, /解答/]) ||
      pickText(root, [".answer", ".reply", "[class*=answer]", "[class*=reply]", "td:nth-child(3)"]),
    rating: null,
    createdAt: findPotentialDate(root),
    raw: { html: root.outerHTML.slice(0, 3000) }
  };
};
const collect = async () => {
  const items = [];
  const seen = new Set();
  await clickTabByText([/问大家/, /问答/, /商品问答/]);
  for (let page = 0; page < MAX_PAGES; page += 1) {
    await waitUntil(() => getTableRows(ROW_SELECTOR).length > 0, 12000);
    await scrollPage(SCROLL_ROUNDS, SCROLL_DELAY_MS);
    getTableRows(ROW_SELECTOR).forEach((row, index) => {
      if (items.length >= LIMIT) return;
      const record = buildRecord(row, index);
      if (!record) return;
      dedupePush(items, seen, record, ["id", "itemTitle", "content", "replyContent"]);
    });
    if (items.length >= LIMIT) break;
    const moved = await clickNextPage(NEXT_SELECTOR);
    if (!moved) break;
  }
  return items;
};
return await collect();
`);

export const buildComplaintCollectScript = ({ limit = 120, scrollRounds = 6, scrollDelayMs = 900, maxPages = 5 } = {}) =>
  compactScript(`
${buildSharedHelpers()}
const LIMIT = ${Number(limit)};
const SCROLL_ROUNDS = ${Number(scrollRounds)};
const SCROLL_DELAY_MS = ${Number(scrollDelayMs)};
const MAX_PAGES = ${Number(maxPages)};
const ROW_SELECTOR = ["[data-complaint-id]", "[data-refund-id]", ".refund-item", ".complaint-item", ".dispute-item", ".next-table-row", "[class*=refund-item]", "[class*=complaint-item]"].join(",");
const NEXT_SELECTOR = [".pagination-next:not(.disabled)", ".next-pagination-item.next:not(.next-disabled)", "button[aria-label*=next]:not([disabled])", "a[aria-label*=next]:not([aria-disabled=true])"].join(",");
const buildRecord = (root, index) => {
  const text = normalizeText(root.innerText ?? root.textContent ?? "");
  if (!text) return null;
  const content =
    findByHeaderOrLabel(root, [/申请原因/, /退款原因/, /投诉原因/, /问题描述/, /原因/, /售后原因/]) ||
    pickText(root, [".reason", ".complaint-content", ".refund-reason", ".content", "[class*=reason]", "[class*=content]", "td:nth-child(2)"]) ||
    findLongestMeaningfulText(getRowTextLines(root));
  return {
    id: normalizeText(root.getAttribute("data-complaint-id") || root.getAttribute("data-refund-id") || "") || String(index + 1),
    source: "complaint",
    channel: "browser",
    itemId: findPotentialItemId(root),
    itemTitle: findPotentialTitle(root),
    content,
    replyContent:
      findByHeaderOrLabel(root, [/处理结果/, /协商记录/, /售后进度/, /平台处理/, /回复/, /备注/]) ||
      pickText(root, [".reply", ".process", ".seller-response", "[class*=reply]", "[class*=process]", "td:nth-child(3)"]),
    rating: null,
    createdAt: findPotentialDate(root),
    raw: { html: root.outerHTML.slice(0, 3000) }
  };
};
const collect = async () => {
  const items = [];
  const seen = new Set();
  await clickTabByText([/退款/, /售后/, /投诉/, /纠纷/]);
  for (let page = 0; page < MAX_PAGES; page += 1) {
    await waitUntil(() => getTableRows(ROW_SELECTOR).length > 0, 12000);
    await scrollPage(SCROLL_ROUNDS, SCROLL_DELAY_MS);
    getTableRows(ROW_SELECTOR).forEach((row, index) => {
      if (items.length >= LIMIT) return;
      const record = buildRecord(row, index);
      if (!record) return;
      dedupePush(items, seen, record, ["id", "itemTitle", "content", "replyContent"]);
    });
    if (items.length >= LIMIT) break;
    const moved = await clickNextPage(NEXT_SELECTOR);
    if (!moved) break;
  }
  return items;
};
return await collect();
`);
