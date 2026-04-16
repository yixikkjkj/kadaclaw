import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const xmlEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getColumnName = (index) => {
  let current = index + 1;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
};

const buildCell = (columnIndex, rowIndex, value) => {
  const reference = `${getColumnName(columnIndex)}${rowIndex + 1}`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
};

const buildSheetXml = (rows) => {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => buildCell(columnIndex, rowIndex, value)).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;
};

const sanitizeSheetName = (name, index) => {
  const cleaned = String(name ?? "")
    .trim()
    .replace(/[[\]:*?/\\]/g, "_")
    .slice(0, 31);
  return cleaned || `Sheet${index}`;
};

export const writeWorkbook = (outputPath, sheets) => {
  const resolvedPath = outputPath.startsWith("~/")
    ? path.join(process.env.HOME ?? "", outputPath.slice(2))
    : outputPath;

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const workbookSheets = [];
  const workbookRelationships = [];
  const worksheetEntries = [];
  const contentOverrides = [];

  sheets.forEach(([name, rows], index) => {
    const sheetIndex = index + 1;
    const sheetName = sanitizeSheetName(name, sheetIndex);

    workbookSheets.push(
      `<sheet name="${xmlEscape(sheetName)}" sheetId="${sheetIndex}" r:id="rId${sheetIndex}"/>`
    );
    workbookRelationships.push(
      `<Relationship Id="rId${sheetIndex}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetIndex}.xml"/>`
    );
    worksheetEntries.push([`xl/worksheets/sheet${sheetIndex}.xml`, buildSheetXml(rows)]);
    contentOverrides.push(
      `<Override PartName="/xl/worksheets/sheet${sheetIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
  });

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets.join("")}</sheets>
</workbook>`;

  const rootRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelationships.join("")}
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentOverrides.join("")}
</Types>`;

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "product-review-analysis-xlsx-"));

  try {
    fs.writeFileSync(path.join(tempDirectory, "[Content_Types].xml"), contentTypesXml, "utf8");
    fs.mkdirSync(path.join(tempDirectory, "_rels"), { recursive: true });
    fs.writeFileSync(path.join(tempDirectory, "_rels/.rels"), rootRelationshipsXml, "utf8");
    fs.mkdirSync(path.join(tempDirectory, "xl/_rels"), { recursive: true });
    fs.mkdirSync(path.join(tempDirectory, "xl/worksheets"), { recursive: true });
    fs.writeFileSync(path.join(tempDirectory, "xl/workbook.xml"), workbookXml, "utf8");
    fs.writeFileSync(
      path.join(tempDirectory, "xl/_rels/workbook.xml.rels"),
      workbookRelationshipsXml,
      "utf8"
    );

    for (const [entryPath, xml] of worksheetEntries) {
      fs.writeFileSync(path.join(tempDirectory, entryPath), xml, "utf8");
    }

    if (fs.existsSync(resolvedPath)) {
      fs.rmSync(resolvedPath, { force: true });
    }

    execFileSync("zip", ["-q", "-r", resolvedPath, "[Content_Types].xml", "_rels", "xl"], {
      cwd: tempDirectory,
    });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};
