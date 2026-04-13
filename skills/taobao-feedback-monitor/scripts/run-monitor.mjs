import fs from "node:fs";
import os from "node:os";
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

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = args["output-dir"];
  const reviewInput = args.reviews;
  const qaInput = args.qa;

  if (!outputDir || (!reviewInput && !qaInput)) {
    console.error(
      "Usage: node skills/taobao-feedback-monitor/scripts/run-monitor.mjs --reviews <file> --qa <file> --output-dir <dir>",
    );
    process.exit(EXIT_USAGE);
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "taobao-feedback-monitor-"));
  const mergedPath = path.join(workDir, "merged.json");
  const normalizedPaths = [];

  if (reviewInput) {
    const reviewOutput = path.join(workDir, "reviews.json");
    runNodeScript(path.join(scriptDir, "import-feedback.mjs"), [
      "--input",
      reviewInput,
      "--source",
      "review",
      "--output",
      reviewOutput,
    ]);
    normalizedPaths.push(reviewOutput);
  }

  if (qaInput) {
    const qaOutput = path.join(workDir, "qa.json");
    runNodeScript(path.join(scriptDir, "import-feedback.mjs"), [
      "--input",
      qaInput,
      "--source",
      "qa",
      "--output",
      qaOutput,
    ]);
    normalizedPaths.push(qaOutput);
  }

  const merged = normalizedPaths.flatMap((currentPath) => JSON.parse(fs.readFileSync(currentPath, "utf8")));
  fs.writeFileSync(mergedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "merged.normalized.json"), `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const analyzeArgs = [
    "--input",
    mergedPath,
    "--output-dir",
    outputDir,
  ];

  if (args["qa-timeout-hours"]) {
    analyzeArgs.push("--qa-timeout-hours", args["qa-timeout-hours"]);
  }
  if (args["cluster-threshold"]) {
    analyzeArgs.push("--cluster-threshold", args["cluster-threshold"]);
  }
  if (args.keywords) {
    analyzeArgs.push("--keywords", args.keywords);
  }

  runNodeScript(path.join(scriptDir, "analyze-feedback.mjs"), analyzeArgs);
};

main();
