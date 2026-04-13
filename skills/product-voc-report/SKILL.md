---
name: product-voc-report
description: Use this skill when the user wants AI to analyze product consumer voice across multiple sources such as product reviews, product Q&A, after-sales complaints, refund reasons, or customer-service logs, then generate a local product optimization report with prioritized issues, positive signals, root-cause hints, and improvement recommendations.
---

# Product VOC Report

Use this skill to turn exported consumer-feedback data into a local product optimization report.

## Goal

- Merge product reviews, product Q&A, after-sales complaints, and similar buyer feedback.
- Normalize different file formats into one schema.
- Identify the strongest positive signals and the most repeated negative issues.
- Weigh complaint signals higher than ordinary comments.
- Generate a Chinese optimization report saved locally.

## Fast Path

- Import one source file:
  - `node skills/product-voc-report/scripts/import-voc-data.mjs --input <file> --source review --output <json>`
  - `node skills/product-voc-report/scripts/import-voc-data.mjs --input <file> --source qa --output <json>`
  - `node skills/product-voc-report/scripts/import-voc-data.mjs --input <file> --source complaint --output <json>`
- Analyze normalized data:
  - `node skills/product-voc-report/scripts/analyze-voc-data.mjs --input <json> --output <analysis-json>`
- Generate a local report:
  - `node skills/product-voc-report/scripts/generate-optimization-report.mjs --input <analysis-json> --output <report-md>`
- Run the full workflow:
  - `node skills/product-voc-report/scripts/run-product-voc-report.mjs --reviews <file> --qa <file> --complaints <file> --output-dir <dir>`

## Workflow

1. Ask for exported local data rather than suggesting direct scraping first.
2. Import each data source into the normalized schema.
3. Merge all normalized records.
4. Analyze:
   - repeated issue themes
   - positive value points
   - severe complaint signals
   - source-level differences
5. Generate a local optimization report with:
   - executive summary
   - top issue priorities
   - representative consumer voice
   - likely root causes
   - recommended product and service actions
6. Return the local output paths and a short summary.

## Output Shape

The report should normally include:

- 总结结论
- 核心优点
- 核心问题
- 售后高风险问题
- 消费者原声摘要
- 优先优化建议
- 建议验证动作

## Notes

- Treat complaints and refund-related data as higher-weight evidence than ordinary comments.
- Distinguish product defects from service issues instead of mixing them into one bucket.
- Prefer repeated evidence over isolated one-off statements.
- If the data sample is small, say so explicitly.

## When To Read References

- Read `references/aspect-rubric.md` when the user wants to adjust issue categories, source weights, or recommendation mapping.
