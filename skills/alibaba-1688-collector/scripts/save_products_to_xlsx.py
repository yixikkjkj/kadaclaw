#!/usr/bin/env python3

import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def compact_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def xml_escape(value: object) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def get_column_name(index: int) -> str:
    current = index + 1
    result = ""

    while current > 0:
        remainder = (current - 1) % 26
        result = chr(65 + remainder) + result
        current = (current - 1) // 26

    return result


def to_rows(payload: object) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return [item for item in payload["items"] if isinstance(item, dict)]

    return []


def build_cell(column_index: int, row_index: int, value: object) -> str:
    ref = f"{get_column_name(column_index)}{row_index + 1}"
    return (
        f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">'
        f"{xml_escape(value)}</t></is></c>"
    )


def read_payload(input_arg: str) -> object:
    if input_arg == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(input_arg).expanduser().read_text("utf8")

    return json.loads(raw)


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python3 skills/alibaba-1688-collector/scripts/save_products_to_xlsx.py <input-json|-> <output-xlsx>",
            file=sys.stderr,
        )
        return 1

    input_arg = sys.argv[1]
    output_path = Path(sys.argv[2]).expanduser()

    payload = read_payload(input_arg)
    rows = to_rows(payload)

    if not rows:
        raise ValueError("输入 JSON 中没有可导出的 items 数据。")

    headers: list[str] = []
    for item in rows:
        for key in item.keys():
            if key not in headers:
                headers.append(key)

    sheet_rows = [
        f'<row r="1">{"".join(build_cell(index, 0, header) for index, header in enumerate(headers))}</row>'
    ]
    for row_index, item in enumerate(rows, start=1):
        cells = "".join(
            build_cell(column_index, row_index, item.get(header, ""))
            for column_index, header in enumerate(headers)
        )
        sheet_rows.append(f'<row r="{row_index + 1}">{cells}</row>')

    workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Products" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    worksheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>{"".join(sheet_rows)}</sheetData>
</worksheet>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    workbook_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""

    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", rels_xml)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml)

    print(
        compact_json(
            {
                "rows": len(rows),
                "outputPath": str(output_path),
                "headers": headers,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
