# Aspect Rubric

This skill groups consumer voice into a few practical optimization buckets.

## Core Aspects

- `quality`: 做工、质量、耐用性、开裂、掉色、异味
- `size-fit`: 尺码、偏大、偏小、脚型、版型
- `comfort`: 舒适度、缓震、闷脚、硌脚、偏硬
- `function`: 功能性、漏水、防滑、保温、支撑、稳定性
- `appearance`: 颜值、颜色、外观、质感
- `packaging-logistics`: 包装、发货、物流、破损
- `service`: 客服、售后、退换货、处理效率
- `value`: 性价比、价格、值不值

## Source Weights

- `review`: `1.0`
- `qa`: `1.1`
- `complaint`: `2.5`

## Recommendation Strategy

- Repeated high-weight issues should appear first in the report.
- Product-side issues should become product optimization recommendations.
- Service-side issues should become process or SOP recommendations.
- If one issue appears in both reviews and complaints, treat it as a stronger signal.
