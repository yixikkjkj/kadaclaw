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

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const outputDir = args["output-dir"];

  if (!inputPath || !outputDir) {
    console.error(
      "Usage: node skills/taobao-buy-advisor/scripts/run-buy-advisor.mjs --input <product-json> --output-dir <dir>",
    );
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const analysisPath = path.join(outputDir, "analysis.json");
  const reportPath = path.join(outputDir, "report.md");

  runNodeScript(path.join(scriptDir, "analyze-product-sentiment.mjs"), [
    "--input",
    inputPath,
    "--output",
    analysisPath,
  ]);

  runNodeScript(path.join(scriptDir, "generate-buy-advice.mjs"), [
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
        verdict: analysis.score?.verdict ?? "",
        score: analysis.score?.total ?? 0,
      },
      null,
      2,
    ),
  );
};

main();
