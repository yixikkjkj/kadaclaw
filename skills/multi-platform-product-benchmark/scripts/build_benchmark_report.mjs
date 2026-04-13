#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { analyzePayload, compactJson, normalizeText } from "./lib/analysis.mjs";
import { writeWorkbook } from "./lib/xlsx-writer.mjs";

const SUMMARY_LABELS = [
  ["platform", "平台"],
  ["targetTitle", "目标商品"],
  ["targetShopName", "目标店铺"],
  ["targetPrice", "目标价格"],
  ["targetSales", "目标销量"],
  ["targetReviewSampleCount", "目标评价样本数"],
  ["targetQaSampleCount", "目标问答样本数"],
  ["competitorCount", "竞品数量"],
  ["topCompetitorSales", "头部竞品销量"],
  ["medianCompetitorPrice", "竞品价格中位数"],
  ["medianCompetitorReviews", "竞品评价量中位数"],
  ["insightCount", "分析结论数"],
];

const printUsage = () => {
  console.error(
    "Usage: node skills/multi-platform-product-benchmark/scripts/build_benchmark_report.mjs <input-json|-> <output-xlsx> [output-json]"
  );
};

const expandHomePath = (targetPath) =>
  targetPath.startsWith("~/") ? path.join(process.env.HOME ?? "", targetPath.slice(2)) : targetPath;

const resolvePath = (targetPath) => {
  const expandedPath = expandHomePath(targetPath);

  if (fs.existsSync(expandedPath)) {
    return fs.realpathSync.native(expandedPath);
  }

  const parentDirectory = path.dirname(expandedPath);
  if (fs.existsSync(parentDirectory)) {
    return path.join(fs.realpathSync.native(parentDirectory), path.basename(expandedPath));
  }

  return expandedPath;
};

const readPayload = (inputArg) => {
  const raw =
    inputArg === "-"
      ? fs.readFileSync(0, "utf8")
      : fs.readFileSync(resolvePath(inputArg), "utf8");
  const payload = JSON.parse(raw);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("输入必须是 JSON 对象。");
  }

  return payload;
};

const buildSummaryRows = (result) => {
  const rows = [["字段", "值"]];
  const { context = {}, summary } = result;

  if (normalizeText(context.sourceUrl)) {
    rows.push(["原始链接", context.sourceUrl]);
  }
  if (normalizeText(context.normalizedUrl)) {
    rows.push(["规范化链接", context.normalizedUrl]);
  }
  if (normalizeText(context.searchKeyword)) {
    rows.push(["检索关键词", context.searchKeyword]);
  }
  if (normalizeText(context.collectedAt)) {
    rows.push(["采集时间", context.collectedAt]);
  }

  for (const [key, label] of SUMMARY_LABELS) {
    rows.push([label, summary[key] ?? ""]);
  }

  return rows;
};

const buildInsightRows = (result) => {
  const rows = [["id", "title", "severity", "evidence", "recommendation"]];

  for (const insight of result.insights ?? []) {
    rows.push([
      insight.id ?? "",
      insight.title ?? "",
      insight.severity ?? "",
      insight.evidence ?? "",
      insight.recommendation ?? "",
    ]);
  }

  return rows;
};

const buildReviewRows = (result) => {
  const rows = [["scope", "metric", "value"]];
  const pushVoiceMetrics = (scope, item) => {
    rows.push([scope, "reviewCount", item.reviewCount ?? ""]);
    rows.push([scope, "negativeReviewCount", item.negativeReviewCount ?? ""]);
    rows.push([scope, "positiveReviewCount", item.positiveReviewCount ?? ""]);
    rows.push([scope, "reviewThemeSummary", item.reviewThemeSummary ?? ""]);
    rows.push([scope, "complaintThemeSummary", item.complaintThemeSummary ?? ""]);
    rows.push([scope, "positiveReviewSamples", (item.positiveReviewSamples ?? []).join(" || ")]);
    rows.push([scope, "negativeReviewSamples", (item.negativeReviewSamples ?? []).join(" || ")]);
  };

  pushVoiceMetrics("target", result.target);
  for (const competitor of result.competitors ?? []) {
    pushVoiceMetrics(competitor.shopName || competitor.productTitle || "competitor", competitor);
  }
  return rows;
};

const buildQaRows = (result) => {
  const rows = [["scope", "metric", "value"]];
  const pushQaMetrics = (scope, item) => {
    rows.push([scope, "qaCount", item.qaCount ?? ""]);
    rows.push([scope, "unresolvedQaCount", item.unresolvedQaCount ?? ""]);
    rows.push([scope, "questionThemeSummary", item.questionThemeSummary ?? ""]);
    rows.push([
      scope,
      "unresolvedQaSamples",
      (item.unresolvedQaSamples ?? [])
        .map((pair) => `${pair.question || ""} => ${pair.answer || ""}`)
        .join(" || "),
    ]);
  };

  pushQaMetrics("target", result.target);
  for (const competitor of result.competitors ?? []) {
    pushQaMetrics(competitor.shopName || competitor.productTitle || "competitor", competitor);
  }
  return rows;
};

const buildTableRows = (items) => {
  if (!items.length) {
    return [["message"], ["No data"]];
  }

  const headers = [];
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    }
  }

  return [headers, ...items.map((item) => headers.map((header) => item[header] ?? ""))];
};

const writeJsonIfNeeded = (outputPath, result) => {
  if (!outputPath) {
    return;
  }

  const resolvedPath = resolvePath(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(result, null, 2), "utf8");
};

const main = () => {
  const inputArg = process.argv[2];
  const outputXlsx = process.argv[3];
  const outputJson = process.argv[4];

  if (!inputArg || !outputXlsx) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const payload = readPayload(inputArg);
  const result = analyzePayload(payload);
  const sheets = [
    ["Summary", buildSummaryRows(result)],
    ["Insights", buildInsightRows(result)],
    ["ReviewAnalysis", buildReviewRows(result)],
    ["QAAnalysis", buildQaRows(result)],
    ["Target", buildTableRows([result.target])],
    ["Competitors", buildTableRows(result.competitors)],
  ];

  writeWorkbook(outputXlsx, sheets);
  writeJsonIfNeeded(outputJson, result);

  console.log(
    compactJson({
      outputPath: resolvePath(outputXlsx),
      jsonPath: outputJson ? resolvePath(outputJson) : "",
      competitorCount: result.competitors.length,
      insightCount: result.insights.length,
      sheets: sheets.map(([name]) => name),
    })
  );
};

main();
