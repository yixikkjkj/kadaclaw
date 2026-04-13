import fs from "node:fs";
import path from "node:path";

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

const toIsoString = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
};

const normalizeReplyStatus = (value) => {
  const text = `${value ?? ""}`.trim().toLowerCase();
  if (!text) {
    return "unknown";
  }
  if (["yes", "y", "true", "1", "replied", "done", "已回复"].includes(text)) {
    return "replied";
  }
  if (["no", "n", "false", "0", "pending", "todo", "未回复"].includes(text)) {
    return "pending";
  }
  return "unknown";
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getFirstValue = (record, aliases) => {
  for (const key of aliases) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return "";
};

const parseCsv = (input) => {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += character;
  }

  row.push(current);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
};

const parseInput = (inputPath) => {
  const content = fs.readFileSync(inputPath, "utf8");
  const extension = path.extname(inputPath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed?.data)) {
      return parsed.data;
    }
    throw new Error("JSON input must be an array or an object with a data array.");
  }

  return parseCsv(content);
};

const normalizeRecord = (record, source, channel) => {
  const normalizedSource = source || getFirstValue(record, ["source"]) || "review";
  const content =
    getFirstValue(record, [
      "content",
      "comment",
      "reviewContent",
      "评价内容",
      "问题内容",
      "问答内容",
      "提问",
      "问题",
      "答案",
    ]) || "";

  return {
    id: `${getFirstValue(record, ["id", "rateId", "reviewId", "commentId", "qid", "questionId"]) || ""}`.trim(),
    source: normalizedSource === "qa" ? "qa" : "review",
    channel: `${getFirstValue(record, ["channel"]) || channel || "manual"}`.trim(),
    itemId: `${getFirstValue(record, ["itemId", "num_iid", "goodsId", "商品id", "宝贝id"]) || ""}`.trim(),
    itemTitle: `${getFirstValue(record, ["itemTitle", "title", "商品标题", "宝贝标题"]) || ""}`.trim(),
    content: `${content}`.trim(),
    rating: toNumber(getFirstValue(record, ["rating", "score", "result", "评价星级", "评分"])),
    createdAt: toIsoString(
      getFirstValue(record, ["createdAt", "created", "time", "date", "评价时间", "提问时间", "发布时间"]),
    ),
    replyStatus: normalizeReplyStatus(
      getFirstValue(record, ["replyStatus", "replied", "商家回复", "是否回复", "reply"]),
    ),
    replyContent: `${getFirstValue(record, ["replyContent", "商家回复内容", "answer", "回答"]) || ""}`.trim(),
    userName: `${getFirstValue(record, ["userName", "nick", "buyerNick", "用户", "买家昵称"]) || ""}`.trim(),
    raw: record,
  };
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const source = args.source;
  const outputPath = args.output;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node skills/taobao-feedback-monitor/scripts/import-feedback.mjs --input <file> --source <review|qa> --output <json>",
    );
    process.exit(EXIT_USAGE);
  }

  const records = parseInput(inputPath);
  const channel = path.extname(inputPath).toLowerCase() === ".json" ? "json-import" : "csv-import";
  const normalized = records
    .map((record) => normalizeRecord(record, source, channel))
    .filter((record) => record.content || record.itemId || record.itemTitle);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        count: normalized.length,
        source: source || "auto",
      },
      null,
      2,
    ),
  );
};

main();
