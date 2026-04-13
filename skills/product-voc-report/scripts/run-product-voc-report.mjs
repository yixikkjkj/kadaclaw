import fs from "node:fs";
import os from "node:os";
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
  const outputDir = args["output-dir"];
  const reviewInput = args.reviews;
  const qaInput = args.qa;
  const complaintInput = args.complaints;

  if (!outputDir || (!reviewInput && !qaInput && !complaintInput)) {
    console.error(
      "Usage: node skills/product-voc-report/scripts/run-product-voc-report.mjs --reviews <file> --qa <file> --complaints <file> --output-dir <dir>",
    );
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "product-voc-report-"));
  const normalizedPaths = [];

  if (reviewInput) {
    const reviewOutput = path.join(workDir, "reviews.json");
    runNodeScript(path.join(scriptDir, "import-voc-data.mjs"), [
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
    runNodeScript(path.join(scriptDir, "import-voc-data.mjs"), [
      "--input",
      qaInput,
      "--source",
      "qa",
      "--output",
      qaOutput,
    ]);
    normalizedPaths.push(qaOutput);
  }

  if (complaintInput) {
    const complaintOutput = path.join(workDir, "complaints.json");
    runNodeScript(path.join(scriptDir, "import-voc-data.mjs"), [
      "--input",
      complaintInput,
      "--source",
      "complaint",
      "--output",
      complaintOutput,
    ]);
    normalizedPaths.push(complaintOutput);
  }

  const merged = normalizedPaths.flatMap((currentPath) => JSON.parse(fs.readFileSync(currentPath, "utf8")));
  const mergedPath = path.join(outputDir, "merged.normalized.json");
  const analysisPath = path.join(outputDir, "analysis.json");
  const reportPath = path.join(outputDir, "report.md");

  fs.writeFileSync(mergedPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  runNodeScript(path.join(scriptDir, "analyze-voc-data.mjs"), [
    "--input",
    mergedPath,
    "--output",
    analysisPath,
  ]);

  runNodeScript(path.join(scriptDir, "generate-optimization-report.mjs"), [
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
      },
      null,
      2,
    ),
  );
};

main();
