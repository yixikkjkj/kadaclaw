import fs from "node:fs";
import path from "node:path";
import { buildReviewCollectScript } from "./lib/browser-review-extract.mjs";

const EXIT_USAGE = 1;
const DEFAULT_PAGE_URL = "https://myseller.taobao.com/";

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
  const outputPath = args.output || "";
  const pageUrl = args["page-url"] || DEFAULT_PAGE_URL;
  const limit = Number(args.limit ?? 100);
  const scrollRounds = Number(args["scroll-rounds"] ?? 6);
  const scrollDelayMs = Number(args["delay-ms"] ?? 1000);
  const maxPages = Number(args["max-pages"] ?? 5);

  const bundle = {
    pageUrl,
    collectScript: buildReviewCollectScript({
      limit,
      scrollRounds,
      scrollDelayMs,
      maxPages,
    }),
    defaults: {
      limit,
      scrollRounds,
      scrollDelayMs,
      maxPages,
    },
    notes: [
      "Open the seller review page in a logged-in browser session before executing collectScript.",
      "If login, captcha, or risk-control appears, resolve it manually and rerun the script in the same session.",
      "The extracted items are already close to the normalized schema and can be saved as JSON for monitor ingestion.",
    ],
  };

  if (!outputPath) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        pageUrl,
      },
      null,
      2,
    ),
  );
};

main();
