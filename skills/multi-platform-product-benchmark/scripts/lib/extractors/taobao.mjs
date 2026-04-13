const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const buildTaobaoCommonCore = () => `
const normalizeText = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
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
const pickTexts = (root, selectors) => {
  const result = [];
  const seen = new Set();
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = normalizeText(node.textContent ?? "");
      if (text && !seen.has(text)) {
        seen.add(text);
        result.push(text);
      }
    }
  }
  return result;
};
const clickTabByKeywords = async (keywords) => {
  const candidates = Array.from(document.querySelectorAll("button, a, div, span"))
    .filter((node) => node instanceof HTMLElement)
    .map((node) => ({
      node,
      text: normalizeText(node.textContent ?? ""),
    }))
    .filter((item) => item.text && keywords.some((keyword) => item.text.includes(keyword)));
  const target = candidates
    .sort((left, right) => left.text.length - right.text.length)
    .find((item) => item.node.offsetParent !== null);
  if (!target) {
    return false;
  }
  target.node.click();
  await wait(1200);
  return true;
};
const smartScroll = async (rounds = 4, delayMs = 900) => {
  for (let index = 0; index < rounds; index += 1) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await wait(delayMs);
  }
};
`;

export const buildTaobaoTargetCollectScript = (reviewLimit = 20, qaLimit = 20) =>
  compactScript(`
    (() => {
      ${buildTaobaoCommonCore()}
      const reviewLimit = ${reviewLimit};
      const qaLimit = ${qaLimit};

      const collectProductMeta = () => {
        const title = pickText(document, [
          "h1",
          "[data-testid*=title]",
          ".ItemHeader--mainTitle",
          "[class*=title]",
        ]);
        const shopName = pickText(document, [
          "[class*=shopName]",
          "[class*=ShopHeader] a",
          "a[href*='shop']",
          "[class*=seller] a",
        ]);
        const price = pickText(document, [
          "[class*=price]",
          ".Price--priceText",
          ".tb-rmb-num",
          "[data-testid*=price]",
        ]);
        const salesText = pickText(document, [
          "[class*=sales]",
          "[class*=sell]",
          "[class*=dealCnt]",
          "[class*=trade]",
        ]);
        const reviewCountText = pickText(document, [
          "[class*=review]",
          "[class*=comment]",
          "[class*=rate]",
        ]);
        const shopScoreText = pickText(document, [
          "[class*=shopScore]",
          "[class*=dsr]",
          "[class*=score]",
        ]);
        const shopTags = pickTexts(document, [
          "[class*=shopTag]",
          "[class*=shopLabel]",
          "[class*=shopBadge]",
        ]).join(" | ");
        const productTags = pickTexts(document, [
          "[class*=tag]",
          "[class*=badge]",
          "[class*=benefit]",
          "[class*=coupon]",
        ]).join(" | ");
        const serviceText = pickTexts(document, [
          "[class*=service]",
          "[class*=promise]",
          "[class*=guarantee]",
        ]).join(" | ");
        const deliveryText = pickText(document, [
          "[class*=delivery]",
          "[class*=shipping]",
          "[class*=logistics]",
        ]);

        return {
          platform: "taobao",
          productTitle: title,
          shopName,
          price,
          salesText,
          reviewCountText,
          shopScoreText,
          shopTags,
          productTags,
          couponText: productTags,
          serviceText,
          deliveryText,
          shippingFrom: pickText(document, ["[class*=from]", "[class*=address]", "[class*=location]"]),
          sellerType: pickText(document, ["[class*=shopType]", "[class*=sellerType]", "[class*=storeType]"]),
          detailImageCount: String(document.querySelectorAll("img").length || ""),
          detailTextLength: String(normalizeText(document.body?.innerText ?? "").length || ""),
          sourcePlatformRankText: pickText(document, ["[class*=rank]", "[class*=hot]", "[class*=top]"]),
          livePromotionText: pickText(document, ["[class*=live]", "[class*=broadcast]"]),
          productUrl: window.location.href,
        };
      };

      const collectReviews = async () => {
        await clickTabByKeywords(["评价", "宝贝评价", "商品评价", "累计评价"]);
        await smartScroll(3, 900);

        const reviewNodes = Array.from(
          document.querySelectorAll([
            "[class*=reviewItem]",
            "[class*=rateItem]",
            "[class*=commentItem]",
            "[class*=ReviewItem]",
            "[data-testid*=review]",
          ].join(","))
        );

        const items = [];
        const seen = new Set();
        for (const node of reviewNodes) {
          const text = pickText(node, [
            "[class*=content]",
            "[class*=comment]",
            "[class*=review]",
            "p",
            "div",
          ]);
          const rating = pickText(node, [
            "[class*=star]",
            "[class*=rate]",
            "[class*=score]",
          ]);
          const tag = pickTexts(node, [
            "[class*=tag]",
            "[class*=sku]",
            "[class*=append]",
          ]).join(" | ");
          const normalized = normalizeText(text);
          if (!normalized || seen.has(normalized)) {
            continue;
          }
          seen.add(normalized);
          items.push({
            text: normalized,
            rating,
            tag,
            isNegative: ["差", "一般", "失望", "问题", "退货", "退款", "破损", "慢"].some((keyword) =>
              normalized.includes(keyword)
            ),
          });
          if (items.length >= reviewLimit) {
            break;
          }
        }
        return items;
      };

      const collectQaPairs = async () => {
        await clickTabByKeywords(["问大家", "问答", "宝贝问答"]);
        await smartScroll(3, 900);

        const qaNodes = Array.from(
          document.querySelectorAll([
            "[class*=qaItem]",
            "[class*=askItem]",
            "[class*=questionItem]",
            "[class*=QaItem]",
            "[data-testid*=qa]",
          ].join(","))
        );

        const items = [];
        const seen = new Set();
        for (const node of qaNodes) {
          const question = pickText(node, [
            "[class*=question]",
            "[class*=ask]",
            "h3",
            "strong",
          ]);
          const answer = pickText(node, [
            "[class*=answer]",
            "[class*=reply]",
            "[class*=content]",
            "p",
          ]);
          const key = normalizeText(\`\${question}|\${answer}\`);
          if (!question || seen.has(key)) {
            continue;
          }
          seen.add(key);
          items.push({ question, answer });
          if (items.length >= qaLimit) {
            break;
          }
        }
        return items;
      };

      return Promise.resolve()
        .then(async () => {
          const meta = collectProductMeta();
          const reviews = await collectReviews();
          const qaPairs = await collectQaPairs();
          return {
            ...meta,
            reviews,
            qaPairs,
          };
        });
    })();
  `);

export const buildTaobaoSearchCollectScript = (limit = 10) =>
  compactScript(`
    (() => {
      ${buildTaobaoCommonCore()}
      const targetCount = ${limit};

      const collectCards = () =>
        Array.from(
          document.querySelectorAll([
            "[class*=doubleCardWrapper]",
            "[class*=Card--doubleCard]",
            "[class*=item-card]",
            "[class*=feed-item]",
            "[data-testid*=search-card]",
            "[class*=SearchItem]",
          ].join(","))
        ).filter((node) => node instanceof HTMLElement);

      return Promise.resolve()
        .then(async () => {
          await smartScroll(4, 900);
          const items = [];
          const seen = new Set();
          for (const node of collectCards()) {
            const productTitle = pickText(node, [
              "[class*=title]",
              "[class*=Title]",
              "a[title]",
              "img[alt]",
            ]);
            const shopName = pickText(node, [
              "[class*=shopName]",
              "[class*=seller]",
              "[class*=store]",
            ]);
            const price = pickText(node, [
              "[class*=price]",
              "[class*=Price]",
            ]);
            const salesText = pickText(node, [
              "[class*=sales]",
              "[class*=deal]",
              "[class*=sell]",
            ]);
            const reviewCountText = pickText(node, [
              "[class*=comment]",
              "[class*=review]",
              "[class*=rate]",
            ]);
            const productUrl = absoluteUrl(
              node.querySelector("a[href]")?.getAttribute("href") ?? ""
            );
            const key = normalizeText(productUrl || productTitle);
            if (!key || seen.has(key)) {
              continue;
            }
            seen.add(key);
            items.push({
              platform: "taobao",
              productTitle,
              shopName,
              price,
              salesText,
              reviewCountText,
              productUrl,
              reviews: [],
              qaPairs: [],
            });
            if (items.length >= targetCount) {
              break;
            }
          }
          return items;
        });
    })();
  `);

export const buildTaobaoExtractorBundle = (competitorCount = 10) => ({
  platform: "taobao",
  implemented: true,
  extractorType: "dom-script",
  targetPageScript: buildTaobaoTargetCollectScript(),
  searchResultsScript: buildTaobaoSearchCollectScript(competitorCount),
  collectionPlan: [
    "在商品详情页执行 targetPageScript，提取主信息、评价、问答。",
    "在淘宝同款搜索结果页执行 searchResultsScript，提取候选竞品基础信息。",
    "对销量最高的若干竞品逐个打开详情页，再执行 targetPageScript 补采竞品评价和问答。",
  ],
});
