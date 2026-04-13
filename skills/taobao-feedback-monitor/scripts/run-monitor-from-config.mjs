import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXIT_USAGE = 1;

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

const resolveConfigPath = (baseDir, targetPath) => {
  if (!targetPath) {
    return "";
  }
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(baseDir, targetPath);
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config;

  if (!configPath) {
    console.error(
      "Usage: node skills/taobao-feedback-monitor/scripts/run-monitor-from-config.mjs --config <config-json>",
    );
    process.exit(EXIT_USAGE);
  }

  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);
  const config = JSON.parse(fs.readFileSync(absoluteConfigPath, "utf8"));
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const outputDir = resolveConfigPath(configDir, config.outputDir || "./monitor-output");

  fs.mkdirSync(outputDir, { recursive: true });

  let reviewInputPath = "";
  if (config.reviews?.mode === "top") {
    reviewInputPath = path.join(outputDir, "top-reviews.json");
    const topArgs = [
      "--output",
      reviewInputPath,
      "--page-no",
      `${config.top?.pageNo ?? 1}`,
      "--page-size",
      `${config.top?.pageSize ?? 40}`,
    ];

    if (config.top?.startDate) {
      topArgs.push("--start-date", `${config.top.startDate}`);
    }
    if (config.top?.endDate) {
      topArgs.push("--end-date", `${config.top.endDate}`);
    }

    runNodeScript(path.join(scriptDir, "fetch-reviews.mjs"), topArgs);
  } else if (config.reviews?.mode === "browser") {
    const bundlePath = path.join(outputDir, "browser-review-bundle.json");
    const bundleArgs = ["--output", bundlePath];
    if (config.reviews?.browserPageUrl) {
      bundleArgs.push("--page-url", `${config.reviews.browserPageUrl}`);
    }
    runNodeScript(path.join(scriptDir, "build-browser-review-bundle.mjs"), bundleArgs);
    reviewInputPath = config.reviews?.browserExtractedPath
      ? resolveConfigPath(configDir, config.reviews.browserExtractedPath)
      : "";
  } else if (config.reviews?.path) {
    reviewInputPath = resolveConfigPath(configDir, config.reviews.path);
  }

  const qaInputPath = config.qa?.path ? resolveConfigPath(configDir, config.qa.path) : "";

  if (config.reviews?.mode === "browser" && !reviewInputPath) {
    console.log(
      JSON.stringify(
        {
          browserRequired: true,
          bundlePath: path.join(outputDir, "browser-review-bundle.json"),
          nextStep:
            "Open the logged-in seller review page, execute collectScript from the bundle, save the result to JSON, then set reviews.browserExtractedPath in the config and rerun.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const runArgs = ["--output-dir", outputDir];
  if (reviewInputPath) {
    runArgs.push("--reviews", reviewInputPath);
  }
  if (qaInputPath) {
    runArgs.push("--qa", qaInputPath);
  }
  if (config.analysis) {
    runArgs.push("--qa-timeout-hours", `${config.analysis.qaTimeoutHours ?? 2}`);
    runArgs.push("--cluster-threshold", `${config.analysis.clusterThreshold ?? 3}`);
    if (Array.isArray(config.analysis.keywords) && config.analysis.keywords.length > 0) {
      runArgs.push("--keywords", config.analysis.keywords.join(","));
    }
  }

  runNodeScript(path.join(scriptDir, "run-monitor.mjs"), runArgs);

  const summaryPath = path.join(outputDir, "summary.json");
  const alertsPath = path.join(outputDir, "alerts.json");

  if (config.alert?.enabled) {
    const alertArgs = [
      "--input",
      alertsPath,
      "--provider",
      `${config.alert.provider || "feishu"}`,
    ];
    if (config.alert.webhook) {
      alertArgs.push("--webhook", `${config.alert.webhook}`);
    }
    runNodeScript(path.join(scriptDir, "send-alert.mjs"), alertArgs);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  console.log(
    JSON.stringify(
      {
        configPath: absoluteConfigPath,
        outputDir,
        total: summary.totals?.total ?? 0,
        alerts: Array.isArray(summary.alerts) ? summary.alerts.length : 0,
      },
      null,
      2,
    ),
  );
};

main();
