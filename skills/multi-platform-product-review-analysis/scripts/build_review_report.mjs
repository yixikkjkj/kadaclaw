#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { analyzePayload, compactJson, normalizeText } from "./lib/analysis.mjs";
import { writeWorkbook } from "./lib/xlsx-writer.mjs";

const printUsage = () => {
  console.error(
    "Usage: node skills/multi-platform-product-review-analysis/scripts/build_review_report.mjs <input-json|-> <output-xlsx> [output-json]"
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

const buildCollectionRows = (result) => {
  const rows = [["字段", "值"]];
  const { context = {}, target = {} } = result;

  if (normalizeText(context.sourceUrl)) {
    rows.push(["原始链接", context.sourceUrl]);
  }
  if (normalizeText(context.normalizedUrl)) {
    rows.push(["规范化链接", context.normalizedUrl]);
  }
  if (normalizeText(context.collectedAt)) {
    rows.push(["采集时间", context.collectedAt]);
  }

  rows.push(["平台", context.platform ?? target.platform ?? ""]);
  rows.push(["页面链接", target.productUrl ?? ""]);
  rows.push(["评论样本数", target.reviewCount ?? 0]);
  rows.push(["问答样本数", target.qaCount ?? 0]);

  return rows;
};

const buildRawReviewRows = (result) => {
  const rows = [["序号", "评论内容", "评分", "标签", "是否疑似负向"]];
  for (const [index, review] of (result.target.reviews ?? []).entries()) {
    rows.push([
      index + 1,
      review.text ?? "",
      review.rating ?? "",
      review.tag ?? "",
      review.isNegative ? "是" : "否",
    ]);
  }
  return rows.length > 1 ? rows : [["说明"], ["暂无评论"]];
};

const buildRawQaRows = (result) => {
  const rows = [["序号", "问题", "回答"]];
  for (const [index, item] of (result.target.qaPairs ?? []).entries()) {
    rows.push([index + 1, item.question ?? "", item.answer ?? ""]);
  }
  return rows.length > 1 ? rows : [["说明"], ["暂无问答"]];
};

const buildDiagnosticRows = (result) => {
  const diagnostics = result.target.runtimeDiagnostics ?? {};
  const counters = diagnostics.counters ?? {};
  const rows = [["字段", "值"]];

  rows.push(["诊断状态", diagnostics.status ?? ""]);
  rows.push(["问题摘要", (diagnostics.issues ?? []).join(" | ")]);
  rows.push(["最近事件类型", diagnostics.lastEvent ?? ""]);
  rows.push(["最近事件详情", diagnostics.lastDetail ?? ""]);
  rows.push(["最近命中的选择器", diagnostics.lastMatchedSelector ?? ""]);
  rows.push(["事件数", counters.eventCount ?? 0]);
  rows.push(["评论节点数", counters.reviewNodeCount ?? 0]);
  rows.push(["评论样本数", counters.reviewSampleCount ?? 0]);
  rows.push(["问答节点数", counters.qaNodeCount ?? 0]);
  rows.push(["问答样本数", counters.qaSampleCount ?? 0]);

  const stages = diagnostics.stages ?? {};
  for (const [stageName, stageValue] of Object.entries(stages)) {
    rows.push([`阶段:${stageName}`, JSON.stringify(stageValue)]);
  }

  for (const [index, event] of (diagnostics.recentEvents ?? []).entries()) {
    rows.push([
      `事件:${index + 1}`,
      JSON.stringify({
        type: event.type ?? "",
        detail: event.detail ?? "",
        timestamp: event.timestamp ?? 0,
      }),
    ]);
  }

  return rows;
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
    ["采集信息", buildCollectionRows(result)],
    ["评论原文", buildRawReviewRows(result)],
    ["问答原文", buildRawQaRows(result)],
    ["采集诊断", buildDiagnosticRows(result)],
  ];

  writeWorkbook(outputXlsx, sheets);
  writeJsonIfNeeded(outputJson, result);

  console.log(
    compactJson({
      outputPath: resolvePath(outputXlsx),
      jsonPath: outputJson ? resolvePath(outputJson) : "",
      reviewCount: result.target.reviewCount ?? 0,
      qaCount: result.target.qaCount ?? 0,
      diagnosticsStatus: result.target.runtimeDiagnostics?.status ?? "",
      sheets: sheets.map(([name]) => name),
    })
  );
};

main();
