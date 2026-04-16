# 钉钉 AI 表格字段与校验（1688 选品）

本文件用于：字段创建、字段映射、数据校验。  
仅在需要创建/写入/校验时加载。

---

## 预设字段（创建 Table 时使用）

说明：本节是字段定义唯一来源。当前流程使用 `table create` 建空表，再用 `field create` 按本定义逐个创建字段。

```json
[
  {"fieldName":"商品ID","type":"text"},
  {"fieldName":"商品标题","type":"text"},
  {"fieldName":"商品链接","type":"url"},
  {"fieldName":"商品主图","type":"url"},
  {"fieldName":"价格","type":"currency","config":{"currencyType":"CNY","decimalPlaces":2}},
  {"fieldName":"销量","type":"number"},
  {"fieldName":"回头率","type":"number","config":{"formatter":"PERCENT"}},
  {"fieldName":"店铺名称","type":"text"},
  {"fieldName":"综合服务星级","type":"number","config":{"formatter":"FLOAT_1"}},
  {"fieldName":"采购咨询分","type":"number","config":{"formatter":"FLOAT_2"}},
  {"fieldName":"品质体验分","type":"number","config":{"formatter":"FLOAT_2"}},
  {"fieldName":"物流时效分","type":"number","config":{"formatter":"FLOAT_2"}},
  {"fieldName":"是否实力商家","type":"checkbox"},
  {"fieldName":"营销标签","type":"multipleSelect"}
]
```

---

## 字段映射（JS → AITable）

| AITable 字段 | JS 字段 | 写入转换 |
|---|---|---|
| 商品ID | itemId | 直接 |
| 商品标题 | title | 直接 |
| 商品链接 | detailLink | `{"link": v, "text": "查看"}` |
| 商品主图 | mainImage | `{"link": v, "text": ""}` |
| 价格 | price | 直接 |
| 销量 | salesQuantity | 直接 |
| 回头率 | returnRate | 直接 |
| 店铺名称 | shopName | 直接 |
| 综合服务星级 | serviceStarRating | null → 0 |
| 采购咨询分 | purchaseConsultScore | 直接 |
| 品质体验分 | qualityExperienceScore | 直接 |
| 物流时效分 | logisticsTimeScore | 直接 |
| 是否实力商家 | isShili | `1→true, 0→false` |
| 营销标签 | marketingTags | 直接（数组） |

---

## 数据完整性校验（必须全通过）

1. 数据非空：`allData.length > 0`
2. 必填字段：`itemId`、`title`、`detailLink`、`mainImage`、`price`、`salesQuantity`、`shopName`、`searchRank`
3. URL 合法：`detailLink`、`mainImage` 需 `http/https`
4. 数量合理：`allData.length >= min(目标数量, 10)`

不通过则直接报错终止流程。

---

## dws 写入流程（简要）

1. 认证检查（必须先通过）：
   `dws auth status`
2. 创建 Base：
   `dws aitable base create --name "<名称>" --format json`
3. 创建 Table（只建表，不内联字段定义）：
   `dws aitable table create --base-id "<BaseID>" --name "商品列表" --format json`
4. 固化字段创建命令参数（避免猜测）：
   `dws aitable field create --help`
5. 创建字段（逐字段执行 `dws aitable field create`，字段定义见“预设字段”；参数名以第4步帮助输出为准）：
   `dws aitable field create <help中要求的base/table/name/type/config参数>`
6. 获取字段 ID：  
   `dws aitable table get --base-id "<BaseID>" --table-ids "<TableID>" --format json`
7. 分批写入记录（使用 fieldId 做 cells 的 key）：
    `dws aitable record create --base-id "<BaseID>" --table-id "<TableID>" --records '<JSON>' --format json`
8. 写入失败仅重试失败批次，禁止全量重写

---

## 写入代码

说明：以下示例使用 Field ID 作为 `cells` 的 key，并固定使用 `--records` 参数。

### Python 组装 `records` 示例

```python
import json

def build_records(all_data, field_ids):
      records = []
      for item in all_data:
            records.append({
                  "cells": {
                        field_ids["商品ID"]: str(item["itemId"]),
                        field_ids["商品标题"]: item["title"],
                        field_ids["商品链接"]: {"link": item["detailLink"], "text": "查看"},
                        field_ids["商品主图"]: {"link": item["mainImage"], "text": ""},
                        field_ids["价格"]: float(item["price"]),
                        field_ids["销量"]: int(item["salesQuantity"]),
                        field_ids["回头率"]: float(item.get("returnRate", 0)),
                        field_ids["店铺名称"]: item["shopName"],
                        field_ids["综合服务星级"]: float(item.get("serviceStarRating") or 0),
                        field_ids["采购咨询分"]: float(item.get("purchaseConsultScore") or 0),
                        field_ids["品质体验分"]: float(item.get("qualityExperienceScore") or 0),
                        field_ids["物流时效分"]: float(item.get("logisticsTimeScore") or 0),
                        field_ids["是否实力商家"]: bool(item.get("isShili", 0)),
                        field_ids["营销标签"]: item.get("marketingTags", [])
                  }
            })
      return records


# records_json 可直接传给 dws --data
records = build_records(all_data, field_ids)
records_json = json.dumps(records, ensure_ascii=False)
```

### dws 写入示例（按批次）

```bash
# 单批示例（建议每批 20~50 条）
dws aitable record create \
   --base-id "<BaseID>" \
   --table-id "<TableID>" \
   --records "$RECORDS_JSON" \
   --format json
```

### 最小可运行 Bash 示例（含临时 JSON 文件）

```bash
cat > /tmp/records.json <<'JSON'
[
   {
      "cells": {
         "fld_item_id": "6845987654321",
         "fld_title": "宠物垫四季通用可拆洗",
         "fld_link": {"link": "https://detail.1688.com/offer/6845987654321.html", "text": "查看"},
         "fld_image": {"link": "https://cbu01.alicdn.com/img/ibank/xxx.jpg", "text": ""},
         "fld_price": 39.9,
         "fld_sales": 1260,
         "fld_return_rate": 0.23,
         "fld_shop": "某某宠物用品厂",
         "fld_star": 4.8,
         "fld_consult": 4.76,
         "fld_quality": 4.83,
         "fld_logistics": 4.72,
         "fld_is_shili": true,
         "fld_tags": ["48h发货", "源头工厂"]
      }
   }
]
JSON

dws aitable record create \
   --base-id "<BaseID>" \
   --table-id "<TableID>" \
   --records "$(cat /tmp/records.json)" \
   --format json
```

注意：

- `cells` 的 key 建议使用 `fieldId`，不要依赖中文字段名
- URL 字段统一使用 `{"link": "...", "text": "..."}`
- 批量写入失败时仅重试失败批次，同时输出失败原因及错误码

门禁：

- `dws auth status` 失败时，立即终止后续 `base/table/field/record` 操作
- `table get` 未返回完整字段时，立即终止 `record create`
- 每批写入后校验返回记录数，数量不一致时仅重试失败批
