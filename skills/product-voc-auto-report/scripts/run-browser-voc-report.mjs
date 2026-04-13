import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

const runNodeScript = (scriptPath, scriptArgs) => {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const resolvePath = (baseDir, targetPath) => {
  if (!targetPath) {
    return "";
  }
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
};

const loadJsonArray = (inputPath) => {
  if (!inputPath) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config;

  if (!configPath) {
    console.error(
      "Usage: node skills/product-voc-auto-report/scripts/run-browser-voc-report.mjs --config <config-json>",
    );
    process.exit(1);
  }

  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);
  const config = JSON.parse(fs.readFileSync(absoluteConfigPath, "utf8"));
  const outputDir = resolvePath(configDir, config.outputDir || "./browser-voc-output");
  fs.mkdirSync(outputDir, { recursive: true });

  const bundlePath = path.join(outputDir, "browser-voc-bundle.json");
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  runNodeScript(path.join(scriptDir, "build-browser-voc-bundle.mjs"), [
    "--output",
    bundlePath,
    "--seller-home",
    `${config.pages?.sellerHome || "https://myseller.taobao.com/"}`,
    "--reviews-page",
    `${config.pages?.reviews || config.pages?.sellerHome || "https://myseller.taobao.com/"}`,
    "--qa-page",
    `${config.pages?.qa || config.pages?.sellerHome || "https://myseller.taobao.com/"}`,
    "--complaints-page",
    `${config.pages?.complaints || config.pages?.sellerHome || "https://myseller.taobao.com/"}`,
  ]);

  const reviewsPath = resolvePath(configDir, config.collected?.reviewsPath || "");
  const qaPath = resolvePath(configDir, config.collected?.qaPath || "");
  const complaintsPath = resolvePath(configDir, config.collected?.complaintsPath || "");

  if (!reviewsPath && !qaPath && !complaintsPath) {
    console.log(
      JSON.stringify(
        {
          browserRequired: true,
          bundlePath,
          nextStep:
            "Open the logged-in seller pages, execute each collectScript from the bundle, save JSON files locally, fill collected.reviewsPath / qaPath / complaintsPath in the config, then rerun.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const merged = [
    ...loadJsonArray(reviewsPath),
    ...loadJsonArray(qaPath),
    ...loadJsonArray(complaintsPath),
  ];
  const mergedPath = path.join(outputDir, "merged.normalized.json");
  const analysisPath = path.join(outputDir, "analysis.json");
  const reportPath = path.join(outputDir, "report.md");
  fs.writeFileSync(mergedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const vocReportScriptDir = path.resolve(scriptDir, "../../product-voc-report/scripts");
  runNodeScript(path.join(vocReportScriptDir, "analyze-voc-data.mjs"), [
    "--input",
    mergedPath,
    "--output",
    analysisPath,
  ]);
  runNodeScript(path.join(vocReportScriptDir, "generate-optimization-report.mjs"), [
    "--input",
    analysisPath,
    "--output",
    reportPath,
  ]);

  const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  console.log(
    JSON.stringify(
      {
        outputDir,
        totalRecords: analysis.summary?.totalRecords ?? 0,
        topIssue: analysis.topNegatives?.[0]?.keyword ?? "",
        reportPath,
      },
      null,
      2,
    ),
  );
};

main();
