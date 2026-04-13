import fs from "node:fs";
import path from "node:path";
import { buildProductCollectScript } from "../../taobao-buy-advisor/scripts/lib/browser-product-extract.mjs";

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

const loadUrls = (args) => {
  if (args.urls) {
    return `${args.urls}`
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!args.input) {
    return [];
  }

  const inputPath = path.resolve(args.input);
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (Array.isArray(parsed)) {
    return parsed.map((item) => `${item}`.trim()).filter(Boolean);
  }
  if (Array.isArray(parsed?.urls)) {
    return parsed.urls.map((item) => `${item}`.trim()).filter(Boolean);
  }
  return [];
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = args.output || "";
  const urls = loadUrls(args);

  if (urls.length === 0) {
    console.error(
      "Usage: node skills/product-link-voc-analyzer/scripts/build-product-link-bundle.mjs --urls <url1,url2> [--output <json>] or --input <config-json>",
    );
    process.exit(1);
  }

  const bundle = {
    count: urls.length,
    collectScript: buildProductCollectScript({
      reviewLimit: Number(args["review-limit"] ?? 80),
      qaLimit: Number(args["qa-limit"] ?? 40),
      scrollRounds: Number(args["scroll-rounds"] ?? 6),
      scrollDelayMs: Number(args["delay-ms"] ?? 1000),
    }),
    targets: urls.map((url, index) => ({
      index: index + 1,
      url,
    })),
    notes: [
      "Open each product page in a browser session and execute the same collectScript.",
      "Save all collected product objects into one JSON array file.",
      "If comments or Q&A require login, reuse the same logged-in session across all product pages.",
    ],
  };

  if (!outputPath) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, count: urls.length }, null, 2));
};

main();
