---
name: product-link-voc-analyzer
description: Use this skill when the user provides one or more Taobao or Tmall product page links and wants AI to analyze each product's consumer voice based on product details, visible reviews, and product Q&A collected through a CDP-connected browser, then generate local per-product reports and a summary report.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Product Link VOC Analyzer

Use this skill to analyze multiple Taobao or Tmall product links through a browser-driven workflow.

## Goal

- Accept a list of product page links.
- Open each product page in a browser session.
- Collect:
  - product title
  - price
  - visible selling points
  - visible reviews
  - visible product Q&A
- Generate:
  - one report per product
  - one cross-product summary report

## Fast Path

- Generate a batch browser bundle from a config:
  - `node skills/product-link-voc-analyzer/scripts/run-product-link-analyzer.mjs --config skills/product-link-voc-analyzer/assets/config.example.json`
- The first run generates the browser bundle and waits for collected JSON.
- After browser collection is saved locally, rerun the same command to generate reports.

## Workflow

1. Prepare a config with product URLs.
2. Run the analyzer once to generate `browser-product-bundle.json`.
3. In a logged-in browser session, open each product page and execute the shared `collectScript`.
4. Save the collected results into one local JSON file.
5. Fill `collectedPath` in the config.
6. Rerun the analyzer.
7. Read:
   - per-product reports
   - summary report

## Output Shape

Each single-product report should include:

- 商品概览
- 核心优点
- 核心问题
- 高频消费者原声
- 问答中的关键疑虑
- 优化建议
- 风险等级

The summary report should include:

- 商品风险排行
- 共同高频问题
- 各商品主卖点稳定性
- 优先优化商品清单

## Notes

- This skill only uses product-page-visible data plus visible reviews and Q&A. It does not include seller-only after-sales data.
- If comments or Q&A require login, reuse one logged-in browser session across all product pages.
- If the visible comment sample is small, the report should say so.
- If the page mixes different SKUs, mention that some feedback may be variant-mixed.

## When To Read References

- Read `references/report-schema.md` when the user wants to adjust the single-product report structure or the cross-product summary sections.
