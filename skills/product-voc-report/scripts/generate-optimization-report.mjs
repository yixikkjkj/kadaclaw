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
const renderKeywordList = (items, fallback) =>
  items.length > 0 ? items.map((item) => `- ${item.keyword}（综合权重 ${item.weight.toFixed(1)}）`) : [`- ${fallback}`];
const renderVoiceList = (items, fallback) =>
  items.length > 0 ? items.map((item) => `- [${item.source}] ${item.content}`) : [`- ${fallback}`];

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/product-voc-report/scripts/generate-optimization-report.mjs --input <analysis-json> --output <report-md>",
    );
    process.exit(1);
  }

  const analysis = loadJson(inputPath);
  const lines = [];
  lines.push("# 商品消费者原声优化报告");
  lines.push("");
  lines.push("## 基本信息");
  lines.push(`- 商品：${analysis.product.itemTitle || "未知商品"}`);
  lines.push(`- 商品ID：${analysis.product.itemId || "未知"}`);
  lines.push(`- 样本总量：${analysis.summary.totalRecords}`);
  lines.push(`- 评价：${analysis.summary.reviewCount} 条`);
  lines.push(`- 问答：${analysis.summary.qaCount} 条`);
  lines.push(`- 售后投诉：${analysis.summary.complaintCount} 条`);
  lines.push(`- 样本规模：${analysis.summary.sampleSizeLevel}`);
  lines.push("");
  lines.push("## 管理层结论");
  lines.push(`- ${analysis.executiveSummary.headline}`);
  lines.push(`- 当前最需要关注的维度：${analysis.executiveSummary.keyPoint || "暂无"}`);
  lines.push(`- 负向信号综合权重：${analysis.executiveSummary.totalNegativeWeight}`);
  lines.push("");
  lines.push("## 核心优点");
  lines.push(...renderKeywordList(analysis.topPositives, "当前未形成明显的稳定优点词。"));
  lines.push("");
  lines.push("## 核心问题");
  lines.push(...renderKeywordList(analysis.topNegatives, "当前未形成明显的稳定问题词。"));
  lines.push("");
  lines.push("## 售后高风险问题");
  lines.push(...renderKeywordList(analysis.severeIssues, "当前未形成高风险售后信号。"));
  lines.push("");
  lines.push("## 消费者原声摘要");
  lines.push("### 正向声音");
  lines.push(...renderVoiceList(analysis.representativeVoice.positive, "暂无明显正向代表性原声。"));
  lines.push("");
  lines.push("### 负向声音");
  lines.push(...renderVoiceList(analysis.representativeVoice.negative, "暂无明显负向代表性原声。"));
  lines.push("");
  lines.push("### 投诉声音");
  lines.push(...renderVoiceList(analysis.representativeVoice.complaint, "暂无投诉原声。"));
  lines.push("");
  lines.push("## 优先优化建议");
  if (analysis.recommendations.length === 0) {
    lines.push("- 当前没有足够信号形成明确的优化优先级。");
  } else {
    analysis.recommendations.forEach((item) => {
      lines.push(`- P${item.priority} ${item.aspect}：${item.reason}`);
      item.actions.forEach((action) => {
        lines.push(`  - ${action}`);
      });
    });
  }
  lines.push("");
  lines.push("## 建议验证动作");
  lines.push("- 对高频负向问题做近 30 天订单与售后交叉验证。");
  lines.push("- 对高风险问题补抽样质检和用户回访。");
  lines.push("- 对详情页承诺与实际体验不符的问题，优先改文案与尺码/功能说明。");
  lines.push(`- ${analysis.sourceInsight.reviewVsComplaintGap}`);
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outputPath }, null, 2));
};

main();
