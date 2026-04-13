import fs from "node:fs";
import path from "node:path";
import { buildProductCollectScript } from "./lib/browser-product-extract.mjs";

const DEFAULT_SEARCH_URL = "https://s.taobao.com/search?q=";
const DEFAULT_ITEM_URL = "https://item.taobao.com/item.htm";

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

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const itemUrl = args.url || "";
  const keyword = args.keyword || "";
  const outputPath = args.output || "";

  if (!itemUrl && !keyword) {
    console.error(
      "Usage: node skills/taobao-buy-advisor/scripts/build-browser-product-bundle.mjs --url <taobao-url> | --keyword <product-name> [--output <json>]",
    );
    process.exit(1);
  }

  const reviewLimit = Number(args["review-limit"] ?? 80);
  const qaLimit = Number(args["qa-limit"] ?? 40);
  const scrollRounds = Number(args["scroll-rounds"] ?? 6);
  const scrollDelayMs = Number(args["delay-ms"] ?? 1000);
  const entryUrl = itemUrl || `${DEFAULT_SEARCH_URL}${encodeURIComponent(keyword)}`;

  const bundle = {
    input: itemUrl ? { type: "url", value: itemUrl } : { type: "keyword", value: keyword },
    entryUrl,
    expectedPageType: itemUrl ? "item" : "search",
    itemUrlHint: itemUrl || DEFAULT_ITEM_URL,
    collectScript: buildProductCollectScript({
      reviewLimit,
      qaLimit,
      scrollRounds,
      scrollDelayMs,
    }),
    defaults: {
      reviewLimit,
      qaLimit,
      scrollRounds,
      scrollDelayMs,
    },
    notes: itemUrl
      ? [
          "Open the item page in a logged-in browser session before executing collectScript.",
          "If the page requires login for comments or Q&A, complete login and reuse the same session.",
        ]
      : [
          "Open the search page and confirm the exact target product first.",
          "Enter the product detail page before executing collectScript.",
        ],
  };

  if (!outputPath) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, entryUrl }, null, 2));
};

main();
