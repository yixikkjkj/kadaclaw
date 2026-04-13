import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EXIT_USAGE = 1;
const DEFAULT_ENDPOINT = "https://eco.taobao.com/router/rest";
const DEFAULT_METHOD = "taobao.traderates.search";
const DEFAULT_FIELDS = [
  "tid",
  "oid",
  "role",
  "nick",
  "result",
  "created",
  "rated_nick",
  "item_title",
  "item_price",
  "content",
].join(",");

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

const buildSign = (params, appSecret) => {
  const sortedKeys = Object.keys(params).sort((left, right) => left.localeCompare(right));
  let source = appSecret;
  sortedKeys.forEach((key) => {
    source += `${key}${params[key]}`;
  });
  source += appSecret;
  return crypto.createHash("md5").update(source, "utf8").digest("hex").toUpperCase();
};

const findList = (payload) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const queue = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current.traderates)) {
      return current.traderates;
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        return value;
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return [];
};

const normalizeReview = (record) => {
  const content = `${record.content ?? record.reply ?? ""}`.trim();
  const result = `${record.result ?? ""}`.trim().toLowerCase();
  const rating = result === "good" ? 5 : result === "neutral" ? 3 : result === "bad" ? 1 : null;

  return {
    id: `${record.oid ?? record.rid ?? record.tid ?? ""}`.trim(),
    source: "review",
    channel: "top-api",
    itemId: `${record.num_iid ?? record.item_id ?? ""}`.trim(),
    itemTitle: `${record.item_title ?? record.title ?? ""}`.trim(),
    content,
    rating,
    createdAt: record.created ? new Date(record.created).toISOString() : "",
    replyStatus: record.reply ? "replied" : "unknown",
    replyContent: `${record.reply ?? ""}`.trim(),
    userName: `${record.rated_nick ?? record.nick ?? ""}`.trim(),
    raw: record,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const appKey = args["app-key"] || process.env.TAOBAO_APP_KEY || "";
  const appSecret = args["app-secret"] || process.env.TAOBAO_APP_SECRET || "";
  const sessionKey = args["session-key"] || process.env.TAOBAO_SESSION_KEY || "";
  const outputPath = args.output;

  if (!appKey || !appSecret || !sessionKey || !outputPath) {
    console.error(
      "Usage: node skills/taobao-feedback-monitor/scripts/fetch-reviews.mjs --output <json> [--start-date <iso>] [--end-date <iso>] with TAOBAO_APP_KEY, TAOBAO_APP_SECRET, and TAOBAO_SESSION_KEY configured.",
    );
    process.exit(EXIT_USAGE);
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const endpoint = args.endpoint || DEFAULT_ENDPOINT;
  const method = args.method || DEFAULT_METHOD;
  const pageNo = args["page-no"] || "1";
  const pageSize = args["page-size"] || "40";

  const params = {
    method,
    app_key: appKey,
    session: sessionKey,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    timestamp,
    fields: args.fields || DEFAULT_FIELDS,
    page_no: pageNo,
    page_size: pageSize,
    rate_type: args["rate-type"] || "get",
    role: args.role || "seller",
  };

  if (args["start-date"]) {
    params.start_date = args["start-date"];
  }
  if (args["end-date"]) {
    params.end_date = args["end-date"];
  }

  params.sign = buildSign(params, appSecret);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams(params),
  });

  const payload = await response.json();
  const errorResponse = payload.error_response;
  if (!response.ok || errorResponse) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(2);
  }

  const normalized = findList(payload).map(normalizeReview).filter((record) => record.content || record.itemTitle);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        method,
        count: normalized.length,
      },
      null,
      2,
    ),
  );
};

await main();
