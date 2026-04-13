import fs from "node:fs";
import path from "node:path";

const EXIT_USAGE = 1;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_NEGATIVE_KEYWORDS = [
  "质量差",
  "假货",
  "破损",
  "漏发",
  "掉色",
  "异味",
  "客服不回",
  "退货",
  "退款",
  "差评",
  "问题",
  "漏水",
  "闷热",
  "线头",
  "做工一般",
];

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
};

const loadJsonArray = (inputPath) => {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Analysis input must be a JSON array.");
  }
  return parsed;
};

const getSeverityRank = (severity) => {
  if (severity === "critical") {
    return 3;
  }
  if (severity === "high") {
    return 2;
  }
  if (severity === "medium") {
    return 1;
  }
  return 0;
};

const detectSignals = (entry, keywords, qaTimeoutHours, nowMs) => {
  const content = `${entry.content ?? ""}`.trim();
  const matchedKeywords = keywords.filter((keyword) => content.includes(keyword));
  const signals = [];
  let severity = "info";

  if (entry.source === "review" && typeof entry.rating === "number" && entry.rating <= 2) {
    signals.push("low_rating");
    severity = "high";
  }

  if (matchedKeywords.length > 0) {
    signals.push("negative_keywords");
    severity = getSeverityRank(severity) >= getSeverityRank("high") ? severity : "high";
  }

  if (entry.source === "qa" && entry.replyStatus === "pending" && entry.createdAt) {
    const createdAtMs = new Date(entry.createdAt).getTime();
    if (!Number.isNaN(createdAtMs) && nowMs - createdAtMs >= qaTimeoutHours * HOUR_MS) {
      signals.push("qa_unanswered_timeout");
      severity = getSeverityRank(severity) >= getSeverityRank("medium") ? severity : "medium";
    }
  }

  return {
    matchedKeywords,
    signals,
    severity,
  };
};

const buildClusterAlerts = (records, clusterThreshold, nowMs) => {
  const grouped = new Map();

  records.forEach((record) => {
    if (record.severity === "info") {
      return;
    }

    const createdAtMs = new Date(record.createdAt || 0).getTime();
    if (Number.isNaN(createdAtMs) || nowMs - createdAtMs > DAY_MS) {
      return;
    }

    const key = `${record.itemId}::${record.itemTitle}`;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  });

  const alerts = [];
  grouped.forEach((group, key) => {
    if (group.length < clusterThreshold) {
      return;
    }

    const [itemId, itemTitle] = key.split("::");
    alerts.push({
      type: "item_negative_cluster",
      severity: "critical",
      itemId,
      itemTitle,
      count: group.length,
      records: group.map((record) => ({
        id: record.id,
        source: record.source,
        content: record.content,
        createdAt: record.createdAt,
      })),
    });
  });

  return alerts;
};

const toMarkdown = (summary) => {
  const lines = [];
  lines.push("# Taobao Feedback Monitor Report");
  lines.push("");
  lines.push("## Overview");
  lines.push(`- Total records: ${summary.totals.total}`);
  lines.push(`- Review records: ${summary.totals.review}`);
  lines.push(`- Q&A records: ${summary.totals.qa}`);
  lines.push(`- Alerts: ${summary.alerts.length}`);
  lines.push("");
  lines.push("## Top Risk Items");

  if (summary.topRiskItems.length === 0) {
    lines.push("- None");
  } else {
    summary.topRiskItems.forEach((item) => {
      lines.push(`- ${item.itemTitle || "(untitled item)"} [${item.itemId || "unknown"}]: ${item.alertCount} alerts`);
    });
  }

  lines.push("");
  lines.push("## Alerts");

  if (summary.alerts.length === 0) {
    lines.push("- None");
  } else {
    summary.alerts.forEach((alert, index) => {
      if (alert.type === "item_negative_cluster") {
        lines.push(
          `${index + 1}. [${alert.severity}] Clustered complaints on ${alert.itemTitle || "(untitled item)"} (${alert.itemId || "unknown"}) x${alert.count}`,
        );
        return;
      }

      lines.push(
        `${index + 1}. [${alert.severity}] ${alert.source} ${alert.itemTitle || "(untitled item)"}: ${alert.content || "(empty content)"}`,
      );
    });
  }

  return `${lines.join("\n")}\n`;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputDir = args["output-dir"];

  if (!inputPath || !outputDir) {
    console.error(
      "Usage: node skills/taobao-feedback-monitor/scripts/analyze-feedback.mjs --input <normalized-json> --output-dir <dir>",
    );
    process.exit(EXIT_USAGE);
  }

  const qaTimeoutHours = Number(args["qa-timeout-hours"] ?? 2);
  const clusterThreshold = Number(args["cluster-threshold"] ?? 3);
  const nowMs = args.now ? new Date(args.now).getTime() : Date.now();
  const keywords = args.keywords ? `${args.keywords}`.split(",").filter(Boolean) : DEFAULT_NEGATIVE_KEYWORDS;
  const entries = loadJsonArray(inputPath);

  const analyzed = entries.map((entry) => {
    const signals = detectSignals(entry, keywords, qaTimeoutHours, nowMs);
    return {
      ...entry,
      matchedKeywords: signals.matchedKeywords,
      signals: signals.signals,
      severity: signals.severity,
    };
  });

  const signalAlerts = analyzed
    .filter((entry) => entry.signals.length > 0)
    .map((entry) => ({
      type: "record_signal",
      severity: entry.severity,
      source: entry.source,
      itemId: entry.itemId,
      itemTitle: entry.itemTitle,
      content: entry.content,
      createdAt: entry.createdAt,
      signals: entry.signals,
      matchedKeywords: entry.matchedKeywords,
      recordId: entry.id,
    }));

  const clusterAlerts = buildClusterAlerts(analyzed, clusterThreshold, nowMs);
  const alerts = [...clusterAlerts, ...signalAlerts].sort(
    (left, right) => getSeverityRank(right.severity) - getSeverityRank(left.severity),
  );

  const riskByItem = new Map();
  alerts.forEach((alert) => {
    const key = `${alert.itemId ?? ""}::${alert.itemTitle ?? ""}`;
    const current = riskByItem.get(key) ?? {
      itemId: alert.itemId ?? "",
      itemTitle: alert.itemTitle ?? "",
      alertCount: 0,
    };
    current.alertCount += 1;
    riskByItem.set(key, current);
  });

  const summary = {
    generatedAt: new Date(nowMs).toISOString(),
    totals: {
      total: analyzed.length,
      review: analyzed.filter((entry) => entry.source === "review").length,
      qa: analyzed.filter((entry) => entry.source === "qa").length,
    },
    alerts,
    topRiskItems: [...riskByItem.values()].sort((left, right) => right.alertCount - left.alertCount).slice(0, 10),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "normalized-with-signals.json"), `${JSON.stringify(analyzed, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "alerts.json"), `${JSON.stringify(alerts, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), toMarkdown(summary), "utf8");

  console.log(JSON.stringify(summary, null, 2));
};

main();
