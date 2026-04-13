import fs from "node:fs";
import path from "node:path";

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

const loadJson = (inputPath) => JSON.parse(fs.readFileSync(inputPath, "utf8"));
const toSafeName = (value, index) =>
  `${value || `product-${index + 1}`}`
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `product-${index + 1}`;

const renderEntries = (items, emptyText, key = "keyword", weight = "weight") =>
  items.length > 0 ? items.map((item) => `- ${item[key]}（权重 ${item[weight]}）`) : [`- ${emptyText}`];

const renderProductReport = (product) => {
  const lines = [];
  lines.push(`# ${product.product.title || "商品分析报告"}`);
  lines.push("");
  lines.push("## 商品概览");
  lines.push(`- 链接：${product.pageUrl || "未知"}`);
  lines.push(`- 价格：${product.product.priceText || "未知"}`);
  lines.push(`- 销量信息：${product.product.salesText || "未知"}`);
  lines.push(`- 评论数：${product.counts.reviews}`);
  lines.push(`- 问答数：${product.counts.qa}`);
  lines.push(`- 风险等级：${product.risk.level}`);
  lines.push(`- 风险分：${product.risk.score}`);
  lines.push("");
  lines.push("## 核心优点");
  lines.push(...renderEntries(product.topPositives, "当前未形成明显稳定的高频优点。"));
  lines.push("");
  lines.push("## 核心问题");
  lines.push(...renderEntries(product.topNegatives, "当前未形成明显稳定的高频问题。"));
  lines.push("");
  lines.push("## 问答中的关键疑虑");
  lines.push(...(product.representativeVoice.qa.length > 0 ? product.representativeVoice.qa.map((item) => `- ${item}`) : ["- 当前未采集到明显问答疑虑。"]));
  lines.push("");
  lines.push("## 消费者原声");
  lines.push(...(product.representativeVoice.reviews.length > 0 ? product.representativeVoice.reviews.map((item) => `- ${item}`) : ["- 当前未采集到代表性评论原声。"]));
  lines.push("");
  lines.push("## 优先优化建议");
  if (product.recommendations.length === 0) {
    lines.push("- 当前没有足够信号形成明确优化优先级。");
  } else {
    product.recommendations.forEach((item) => {
      lines.push(`- P${item.priority} ${item.aspect}`);
      item.actions.forEach((action) => {
        lines.push(`  - ${action}`);
      });
    });
  }
  lines.push("");
  lines.push("## 结论");
  lines.push(`- ${product.summary}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const renderSummaryReport = (analysis) => {
  const lines = [];
  lines.push("# 商品链接消费者分析汇总");
  lines.push("");
  lines.push("## 总览");
  lines.push(`- 商品数：${analysis.totalProducts}`);
  lines.push("");
  lines.push("## 商品风险排行");
  if (analysis.summary.rankedProducts.length === 0) {
    lines.push("- 暂无");
  } else {
    analysis.summary.rankedProducts.forEach((item) => {
      lines.push(`- ${item.rank}. ${item.title}：${item.riskLevel}（${item.riskScore}）`);
    });
  }
  lines.push("");
  lines.push("## 共同高频问题");
  lines.push(...renderEntries(analysis.summary.commonIssues, "暂无共同高频问题。"));
  lines.push("");
  lines.push("## 共同正向卖点");
  lines.push(...renderEntries(analysis.summary.commonPositives, "暂无共同稳定卖点。"));
  lines.push("");
  lines.push("## 优先优化商品");
  if (analysis.summary.priorityProducts.length === 0) {
    lines.push("- 当前没有高优先级商品。");
  } else {
    analysis.summary.priorityProducts.forEach((item) => {
      lines.push(`- ${item.title}：${item.riskLevel}（${item.riskScore}）`);
    });
  }
  lines.push("");
  lines.push("## 建议下一步");
  lines.push("- 对高风险商品优先补采更多评论和问答样本。");
  lines.push("- 对共同问题词进行详情页、规格说明和商品本身的交叉验证。");
  lines.push("- 对风险等级高的商品优先安排商品优化或页面说明优化。");
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputDir = args["output-dir"];

  if (!inputPath || !outputDir) {
    console.error(
      "Usage: node skills/product-link-voc-analyzer/scripts/generate-product-link-reports.mjs --input <analysis-json> --output-dir <dir>",
    );
    process.exit(1);
  }

  const analysis = loadJson(inputPath);
  const reportsDir = path.join(outputDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  analysis.products.forEach((product, index) => {
    const filename = `${String(index + 1).padStart(2, "0")}-${toSafeName(product.product.title, index)}.md`;
    fs.writeFileSync(path.join(reportsDir, filename), renderProductReport(product), "utf8");
  });

  fs.writeFileSync(path.join(reportsDir, "summary.md"), renderSummaryReport(analysis), "utf8");
  console.log(JSON.stringify({ reportsDir, count: analysis.products.length }, null, 2));
};

main();
