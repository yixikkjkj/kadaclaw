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

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config;

  if (!configPath) {
    console.error(
      "Usage: node skills/product-link-voc-analyzer/scripts/run-product-link-analyzer.mjs --config <config-json>",
    );
    process.exit(1);
  }

  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);
  const config = JSON.parse(fs.readFileSync(absoluteConfigPath, "utf8"));
  const outputDir = resolvePath(configDir, config.outputDir || "./product-link-voc-output");
  fs.mkdirSync(outputDir, { recursive: true });

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const bundlePath = path.join(outputDir, "browser-product-bundle.json");
  const bundleInputPath = path.join(outputDir, "bundle-input.json");
  fs.writeFileSync(bundleInputPath, `${JSON.stringify({ urls: config.urls || [] }, null, 2)}\n`, "utf8");

  runNodeScript(path.join(scriptDir, "build-product-link-bundle.mjs"), [
    "--input",
    bundleInputPath,
    "--output",
    bundlePath,
  ]);

  const collectedPath = resolvePath(configDir, config.collectedPath || "");
  if (!collectedPath) {
    console.log(
      JSON.stringify(
        {
          browserRequired: true,
          bundlePath,
          nextStep:
            "Open each product URL from the bundle, execute collectScript, save all collected product objects into one JSON array, set collectedPath in the config, then rerun.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const analysisPath = path.join(outputDir, "analysis.json");
  runNodeScript(path.join(scriptDir, "analyze-product-link-voc.mjs"), [
    "--input",
    collectedPath,
    "--output",
    analysisPath,
  ]);
  runNodeScript(path.join(scriptDir, "generate-product-link-reports.mjs"), [
    "--input",
    analysisPath,
    "--output-dir",
    outputDir,
  ]);

  const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  console.log(
    JSON.stringify(
      {
        outputDir,
        totalProducts: analysis.totalProducts,
        highestRiskProduct: analysis.summary?.rankedProducts?.[0]?.title ?? "",
        summaryReport: path.join(outputDir, "reports", "summary.md"),
      },
      null,
      2,
    ),
  );
};

main();
