import fs from "node:fs";
import path from "node:path";
import {
  buildComplaintCollectScript,
  buildQaCollectScript,
  buildReviewCollectScript,
} from "./lib/browser-voc-extract.mjs";

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
  const sellerHome = args["seller-home"] || "https://myseller.taobao.com/";
  const reviewsPage = args["reviews-page"] || sellerHome;
  const qaPage = args["qa-page"] || sellerHome;
  const complaintsPage = args["complaints-page"] || sellerHome;

  const bundle = {
    sellerHome,
    pages: {
      reviews: {
        pageUrl: reviewsPage,
        collectScript: buildReviewCollectScript(),
      },
      qa: {
        pageUrl: qaPage,
        collectScript: buildQaCollectScript(),
      },
      complaints: {
        pageUrl: complaintsPage,
        collectScript: buildComplaintCollectScript(),
      },
    },
    notes: [
      "Open each seller page in the same logged-in browser session before executing the matching collectScript.",
      "If page URLs are unstable, navigate manually from sellerHome and then execute the script on the correct page.",
      "Save each collected result as a local JSON file and then rerun the report runner with those file paths.",
    ],
  };

  if (!outputPath) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath }, null, 2));
};

main();
