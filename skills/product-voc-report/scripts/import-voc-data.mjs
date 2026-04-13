import fs from "node:fs";
import path from "node:path";

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

const getFirstValue = (record, aliases) => {
  for (const key of aliases) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return "";
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

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeRecord = (record, source, channel) => ({
  id: `${getFirstValue(record, ["id", "reviewId", "qaId", "complaintId"]) || ""}`.trim(),
  source,
  channel,
  itemId: `${getFirstValue(record, ["itemId", "goodsId", "商品id"]) || ""}`.trim(),
  itemTitle: `${getFirstValue(record, ["itemTitle", "title", "商品标题"]) || ""}`.trim(),
  content: `${getFirstValue(record, ["content", "comment", "question", "投诉内容"]) || ""}`.trim(),
  replyContent: `${getFirstValue(record, ["replyContent", "answer", "商家回复"]) || ""}`.trim(),
  rating: toNumber(getFirstValue(record, ["rating", "score", "评分"])),
  createdAt: toIsoString(getFirstValue(record, ["createdAt", "created", "date", "时间"])),
  raw: record,
});

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const source = args.source;
  const outputPath = args.output;

  if (!inputPath || !source || !outputPath) {
    console.error(
      "Usage: node skills/product-voc-report/scripts/import-voc-data.mjs --input <file> --source <review|qa|complaint> --output <json>",
    );
    process.exit(1);
  }

  const records = parseInput(inputPath);
  const channel = path.extname(inputPath).toLowerCase() === ".json" ? "json-import" : "csv-import";
  const normalized = records
    .map((record) => normalizeRecord(record, source, channel))
    .filter((record) => record.content || record.replyContent || record.itemTitle);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ inputPath, outputPath, count: normalized.length, source }, null, 2));
};

main();
