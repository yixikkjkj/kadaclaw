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

const linesForEntries = (entries, fallback) => {
  if (!entries || entries.length === 0) {
    return [`- ${fallback}`];
  }
  return entries.map((entry) => `- ${entry.keyword}（提及 ${entry.count} 次）`);
};

const linesForTextList = (entries) => entries.map((entry) => `- ${entry}`);

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/taobao-buy-advisor/scripts/generate-buy-advice.mjs --input <analysis-json> --output <report-md>",
    );
    process.exit(1);
  }

  const analysis = loadJson(inputPath);
  const lines = [];
  lines.push("# 淘宝商品购买建议");
  lines.push("");
  lines.push("## 结论");
  lines.push(`- 商品：${analysis.product.title || "未知商品"}`);
  lines.push(`- 价格：${analysis.product.priceText || "未知"}`);
  lines.push(`- 最终判断：${analysis.score.verdict}`);
  lines.push(`- 综合分数：${analysis.score.total}/100`);
  lines.push("");
  lines.push("## 为什么可以买");
  lines.push(...linesForEntries(analysis.strengths, "当前可见评论里没有形成稳定的强优势信号"));
  lines.push("");
  lines.push("## 为什么要谨慎");
  lines.push(...linesForEntries(analysis.issues, "当前没有明显重复风险，但样本可能偏少"));
  lines.push("");
  lines.push("## 问答里的关键信号");
  lines.push(...linesForEntries(analysis.qaSignals.risks, "当前问答没有形成明显风险关键词"));
  lines.push("");
  lines.push("## 适合谁");
  lines.push(...linesForTextList(analysis.audience.suitable));
  lines.push("");
  lines.push("## 不适合谁");
  lines.push(...linesForTextList(analysis.audience.avoid));
  lines.push("");
  lines.push("## 评分拆分");
  lines.push(`- 评论质量：${analysis.score.dimensions.reviewQuality}/35`);
  lines.push(`- 严重问题：${analysis.score.dimensions.severeIssues}/25`);
  lines.push(`- 问答信息：${analysis.score.dimensions.qaClarity}/20`);
  lines.push(`- 价格与风险匹配：${analysis.score.dimensions.priceFit}/20`);
  lines.push("");
  lines.push("## 总结");
  lines.push(`- ${analysis.bottomLine}`);
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outputPath }, null, 2));
};

main();
