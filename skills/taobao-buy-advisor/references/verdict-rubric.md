# Verdict Rubric

This skill uses a simple buyer-side scoring model. The intent is not to perfectly predict product quality, but to turn visible reviews and Q&A into a practical purchase judgment.

## Score Buckets

- `75-100`: 值得买
- `60-74`: 谨慎买
- `0-59`: 不推荐

## Dimensions

- Review sentiment and rating quality: `35`
- Recurring severe issues: `25`
- Q&A clarity and risk signals: `20`
- Price-risk fit: `20`

## High-Risk Issues

These issues receive heavier penalties when repeated:

- 异味大
- 漏水
- 做工差
- 质量差
- 尺寸严重不符
- 掉色
- 假货嫌疑
- 容易坏
- 噪音大
- 发热严重

## Mild Issues

These issues matter, but do not automatically make the item a bad buy:

- 包装一般
- 发货慢
- 颜色轻微色差
- 说明书不清楚
- 配件普通

## Evidence Rules

- Repeated complaints matter more than a single complaint.
- A problem mentioned in both reviews and Q&A is stronger evidence than either source alone.
- If the visible sample is small, the report should say so instead of sounding certain.
- High praise without concrete details should count less than specific usage feedback.
