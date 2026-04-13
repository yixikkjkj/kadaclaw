#!/usr/bin/env node

import { compactJson } from "./lib/analysis.mjs";
import { buildPlatformExtractorBundle } from "./lib/extractors/index.mjs";
import { buildDefaultOutputPath, normalizeProductUrl } from "./lib/platforms.mjs";

const printUsage = () => {
  console.error(
    "Usage: node skills/multi-platform-product-benchmark/scripts/build_product_benchmark_bundle.mjs <product-url> [competitor-count]"
  );
};

const parseCompetitorCount = (value) => {
  const count = Number.parseInt(value ?? "10", 10);
  return Number.isFinite(count) && count > 0 ? count : 10;
};

const main = () => {
  const productUrl = process.argv[2]?.trim() ?? "";
  if (!productUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const parsed = normalizeProductUrl(productUrl);
  const competitorCount = parseCompetitorCount(process.argv[3]);
  const extractorBundle = buildPlatformExtractorBundle(parsed.platform, competitorCount);

  console.log(
    compactJson({
      platform: parsed.platform,
      originalUrl: parsed.originalUrl,
      normalizedUrl: parsed.normalizedUrl,
      openUrl: parsed.originalUrl,
      host: parsed.host,
      productId: parsed.productId,
      competitorCount,
      suggestedOutputPath: buildDefaultOutputPath(parsed.platform),
      browserRequired: true,
      domExtractorImplemented: extractorBundle.implemented,
      extractorType: extractorBundle.extractorType,
      nextAction:
        "Use the default runtime-provided CDP browser to open openUrl first. Do not ask the user for ws:// endpoints, ports, or any browser connection info. Wait for redirect or login if needed, then collect visible product fields from the resolved page.",
      targetPageScript: extractorBundle.targetPageScript,
      searchResultsScript: extractorBundle.searchResultsScript,
      collectionPlan: extractorBundle.collectionPlan,
      recommendedFields: [
        "productTitle",
        "shopName",
        "price",
        "salesText",
        "reviewCountText",
        "shopScoreText",
        "shopTags",
        "productTags",
        "couponText",
        "serviceText",
        "deliveryText",
        "shippingFrom",
        "sellerType",
        "detailImageCount",
        "detailTextLength",
        "sourcePlatformRankText",
        "livePromotionText",
        "productUrl",
        "reviews",
        "qaPairs",
      ],
      notes: [
        "优先使用已登录浏览器会话采集可见字段。",
        "默认使用运行环境提供的 CDP 浏览器能力，不要向用户索取连接信息。",
        "评价和问答是主分析输入，价格和销量是辅助信号。",
        "当前只内置了淘宝 DOM 提取器，其它平台需要分别适配。",
        "同款检索仅限原平台，优先选择销量排序或销量优先结果。",
        "分析结论基于可见信号，不代表平台内部真实流量原因。",
      ],
    })
  );
};

main();
