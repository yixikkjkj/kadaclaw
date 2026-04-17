#!/usr/bin/env node

import { compactJson } from "./lib/analysis.mjs";
import { buildPlatformExtractorBundle } from "./lib/extractors/index.mjs";
import { buildDefaultOutputPath, normalizeProductUrl } from "./lib/platforms.mjs";

const printUsage = () => {
  console.error(
    "Usage: node skills/multi-platform-product-review-analysis/scripts/build_product_review_bundle.mjs <product-url>",
  );
};

const main = () => {
  const productUrl = process.argv[2]?.trim() ?? "";
  if (!productUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const parsed = normalizeProductUrl(productUrl);
  const extractorBundle = buildPlatformExtractorBundle(parsed.platform, parsed.originalUrl);

  console.log(
    compactJson({
      platform: parsed.platform,
      normalizedUrl: parsed.normalizedUrl,
      openUrl: parsed.originalUrl,
      suggestedOutputPath: buildDefaultOutputPath(parsed.platform),
      browserRequired: true,
      domExtractorImplemented: extractorBundle.implemented,
      extractorType: extractorBundle.extractorType,
      browserSteps: extractorBundle.browserSteps,
      collectionPlan: extractorBundle.collectionPlan,
      recommendedFields: ["productUrl", "reviews", "qaPairs", "runtimeDiagnostics"],
      notes: [
        "如果浏览器工具报 No pages available in the connected browser，先执行 browserSteps 里的 navigate。",
        "浏览器工具若要求 act.kind，必须把 browserSteps 里的 kind 原样透传。",
        "所有 evaluate 都走 fn 参数，且 fn 必须是完整函数体字符串。",
        "最后一步 evaluate 会返回 JSON 字符串，需要解析成 target 对象。",
        "淘宝提取器已改为分片注入，必须逐步执行全部 append chunk 步骤，不能跳过。",
        "优先使用已登录浏览器会话采集可见字段。",
        "默认使用运行环境提供的 CDP 浏览器能力，不要向用户索取连接信息。",
        "当前采集只保留评论、问答和诊断信息，不再提取商品基础字段。",
        "当前只内置了淘宝 DOM 提取器，其它平台需要分别适配。",
        "若评论或问答为空，优先查看 runtimeDiagnostics 判断是入口点击失败、容器未出现，还是正文 selector 失效。",
        "分析结论基于可见信号，不代表平台内部真实流量原因。",
      ],
    }),
  );
};

main();
