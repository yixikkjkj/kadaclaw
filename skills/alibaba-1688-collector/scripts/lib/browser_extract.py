import json


def compact_script(script: str) -> str:
    return " ".join(line.strip() for line in script.splitlines() if line.strip())


def build_extraction_core(keyword: str = "") -> str:
    request_keyword = json.dumps(keyword, ensure_ascii=False)
    return """const REQUEST_KEYWORD = __REQUEST_KEYWORD__;

const CARD_SELECTOR = [
  ".search-offer-wrapper",
  ".ocms-fusion-1688-pc-pc-ad-common-offer-2024",
  "[data-offer-id]",
  ".offer-card",
  ".sm-offer-item",
  ".common-offer-card",
  ".offer-list-row",
  ".fy23-search-card",
  "[class*=offer][class*=item]",
].join(",");

const NEXT_PAGE_SELECTOR = [
  ".fui-paging-list .fui-next",
  ".fui-pagination-next",
  ".next-btn",
  "[class*=next]",
].join(",");

const normalizeText = (value) => (value ?? "").replace(/\\s+/g, " ").trim();

const absoluteUrl = (value) => {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, window.location.href).href;
  } catch {
    return value;
  }
};

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

const parseReport = (value) => {
  const result = {};
  const source = normalizeText(value);

  if (!source) {
    return result;
  }

  source
    .replace(/^.*?@/, "")
    .split("^")
    .forEach((pair) => {
      const [rawKey, ...rest] = pair.split("@");
      if (!rawKey) {
        return;
      }

      const rawValue = rest.join("@");
      try {
        result[rawKey] = decodeURIComponent(rawValue || "");
      } catch {
        result[rawKey] = rawValue || "";
      }
    });

  return result;
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

const pickAttr = (root, selectors, attribute) => {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const value = normalizeText(node?.getAttribute(attribute) ?? "");
    if (value) {
      return value;
    }
  }

  return "";
};

const extractOfferIdFromUrl = (value) => {
  const href = absoluteUrl(value);
  const match =
    href.match(/offer\\/(\\d+)\\.html/i) ||
    href.match(/[?&](?:offerId|id)=(\\d+)/i) ||
    href.match(/\\b(\\d{8,})\\b/);

  return match?.[1] ?? "";
};

const getCards = () =>
  Array.from(document.querySelectorAll(CARD_SELECTOR)).filter((node) => node instanceof HTMLElement);

const getVisibleCardCount = () => getCards().length;

const getDocumentHeight = () =>
  Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0,
  );

const getPageMarker = () =>
  getCards()
    .slice(0, 5)
    .map((root) => {
      const title = pickText(root, ["a[title]", ".title-text", ".offer-title", "[class*=title]"]);
      const link = absoluteUrl(
        pickAttr(root, ["a[href]", ".title a[href]", "[class*=title] a[href]"], "href"),
      );
      return `${title}|${link}`;
    })
    .join("\\n");

const buildItem = (root, index) => {
  const report = parseReport(root.getAttribute("data-aplus-report") || "");
  const rawLink =
    root.getAttribute("href") ||
    pickAttr(root, ["a[href]", ".title a[href]", "[class*=title] a[href]"], "href");
  const productUrl = absoluteUrl(rawLink);
  const title = pickText(root, [
    ".title-text",
    "a[title]",
    "[title]",
    ".title a",
    ".offer-title",
    "[class*=title]",
  ]);
  const imageNode = root.querySelector(".main-img, img");
  const itemId =
    normalizeText(
      report.offerId ||
        report.object_id ||
        root.getAttribute("data-offer-id") ||
        root.getAttribute("data-id") ||
        root.getAttribute("data-key-value")?.replace(/^offer_/, "") ||
        root.getAttribute("data-renderkey")?.split("_").pop() ||
        extractOfferIdFromUrl(productUrl),
    ) || `${title}|${productUrl}|${index + 1}`;
  const isAd =
    report._p_isad === "1" ||
    /_p_isad@1/.test(root.getAttribute("data-aplus-report") || "") ||
    root.innerText.includes("广告");

  return {
    itemId,
    keyword:
      normalizeText(REQUEST_KEYWORD) ||
      normalizeText(new URL(window.location.href).searchParams.get("keywords") ?? ""),
    productTitle: title,
    price: pickText(root, [".text-main", ".price", ".price-now", ".offer-price", "[class*=price]"]),
    priceText: pickText(root, [".price-info", ".price-range", ".price-item", "[class*=price]"]),
    minimumOrderQuantity: pickText(root, [
      ".col-desc_after",
      ".moq",
      ".sale-count",
      "[class*=order]",
      "[class*=quantity]",
    ]),
    sellerName: pickText(root, [
      ".offer-shop-row .desc-text",
      ".company-name",
      ".shop-name",
      "[class*=shop]",
      "[class*=company]",
    ]),
    sellerLocation: pickText(root, [
      ".company-address",
      ".location",
      "[class*=address]",
      "[class*=location]",
    ]),
    productUrl,
    productImageUrl: absoluteUrl(
      imageNode?.getAttribute("src") ||
        imageNode?.getAttribute("data-src") ||
        imageNode?.getAttribute("data-lazy-src") ||
        "",
    ),
    tags: Array.from(
      root.querySelectorAll(
        [".tag-text", ".offer-tag", ".factory-tag", ".impression-tag", ".offer-tag-row .desc-text", "[data-role*=tag]"].join(","),
      ),
    )
      .map((node) => normalizeText(node.textContent ?? ""))
      .filter(Boolean)
      .join(" | "),
    isAd,
  };
};

const appendNewItems = (items, limit, seenKeys) => {
  let added = 0;

  getCards().forEach((root, index) => {
    if (items.length >= limit) {
      return;
    }

    const item = buildItem(root, index);
    const key = item.itemId || item.productUrl || item.productTitle;

    if (!key || (!item.productTitle && !item.productUrl) || item.isAd || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    items.push(item);
    added += 1;
  });

  return added;
};

const collectItems = (limit, seenKeys) => {
  const items = [];
  appendNewItems(items, limit, seenKeys);
  return items;
};

const smartScrollAndCollect = async (items, targetCount, seenKeys, maxRounds, delayMs) => {
  let lastVisibleCount = getVisibleCardCount();
  let lastHeight = getDocumentHeight();
  let stableRounds = 0;

  for (let index = 0; index < maxRounds; index += 1) {
    if (items.length >= targetCount) {
      return true;
    }

    const previousVisibleCount = lastVisibleCount;
    const previousHeight = lastHeight;

    window.scrollBy({
      top: Math.max(Math.floor(window.innerHeight * 0.9), 900),
      behavior: index === 0 ? "auto" : "smooth",
    });
    await waitUntil(
      () => getVisibleCardCount() > previousVisibleCount || getDocumentHeight() > previousHeight,
      delayMs,
    );
    await wait(180);

    const nextVisibleCount = getVisibleCardCount();
    const nextHeight = getDocumentHeight();
    const added = appendNewItems(items, targetCount, seenKeys);

    if (items.length >= targetCount) {
      return true;
    }

    if (nextVisibleCount > previousVisibleCount || nextHeight > previousHeight || added > 0) {
      lastVisibleCount = nextVisibleCount;
      lastHeight = nextHeight;
      stableRounds = 0;
      continue;
    }

    stableRounds += 1;
    if (stableRounds >= 1) {
      break;
    }
  }

  return items.length >= targetCount || getVisibleCardCount() > lastVisibleCount;
};

const goToNextPage = async () => {
  const button = Array.from(document.querySelectorAll(NEXT_PAGE_SELECTOR)).find((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const text = normalizeText(node.textContent ?? "");
    const disabled =
      node.getAttribute("disabled") !== null ||
      node.getAttribute("aria-disabled") === "true" ||
      node.classList.contains("disabled") ||
      node.classList.contains("is-disabled") ||
      node.classList.contains("fui-next-disabled");

    return !disabled && (text.includes("下一") || text.toLowerCase().includes("next") || node.className.includes("next"));
  });

  if (!(button instanceof HTMLElement)) {
    return false;
  }

  const previousUrl = window.location.href;
  const previousMarker = getPageMarker();
  button.click();

  const moved = await waitUntil(() => {
    const nextMarker = getPageMarker();
    return window.location.href !== previousUrl || (nextMarker && nextMarker !== previousMarker);
  }, 6000, 200);

  if (moved) {
    window.scrollTo(0, 0);
    await waitUntil(() => getVisibleCardCount() > 0, 2500, 120);
    await wait(200);
    return true;
  }

  return false;
};

const finalizeResult = (items) =>
  JSON.stringify(
    {
      pageUrl: window.location.href,
      count: items.length,
      items,
    },
    null,
    2,
  );""".replace("__REQUEST_KEYWORD__", request_keyword, 1)


def build_extract_products_script(limit: int) -> str:
    return compact_script(f"""(() => {{
  const limit = {limit};
  {build_extraction_core()}
  const seenKeys = new Set();
  const items = collectItems(limit, seenKeys).slice(0, limit);
  return finalizeResult(items);
}})()""")


def build_scroll_and_extract_products_script(
    limit: int,
    scroll_rounds: int,
    scroll_delay_ms: int,
    keyword: str = "",
) -> str:
    return compact_script(f"""(async () => {{
  const limit = {limit};
  const scrollRounds = {scroll_rounds};
  const scrollDelayMs = {scroll_delay_ms};
  const pageLimit = 8;
  {build_extraction_core(keyword)}

  const seenKeys = new Set();
  const items = [];
  let pageTurns = 0;

  while (items.length < limit) {{
    const beforeCount = items.length;
    appendNewItems(items, limit, seenKeys);

    if (items.length >= limit) {{
      break;
    }}

    await smartScrollAndCollect(items, limit, seenKeys, scrollRounds, scrollDelayMs);

    if (items.length >= limit) {{
      break;
    }}

    if (items.length > beforeCount) {{
      continue;
    }}

    if (pageTurns >= pageLimit) {{
      break;
    }}

    const moved = await goToNextPage();
    if (!moved) {{
      break;
    }}

    pageTurns += 1;
  }}

  return finalizeResult(items.slice(0, limit));
}})()""")
