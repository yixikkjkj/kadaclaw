---
name: product-voc-auto-report
description: Use this skill when a merchant wants to automatically monitor and analyze their own shop's consumer voice using a CDP-connected logged-in seller browser instead of APIs. Collect product reviews, product Q&A, and after-sales complaint pages from the seller console, save local JSON snapshots, and generate a local optimization report with prioritized issues and improvement actions.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Product VOC Auto Report

Use this skill to collect multi-source seller-console feedback through a CDP-connected logged-in browser, then generate a local product optimization report.

## Goal

- Use the merchant's own logged-in seller session instead of platform APIs.
- Collect three browser-side sources:
  - product reviews
  - product Q&A
  - after-sales complaints or refund/dispute pages
- Save collected JSON locally.
- Generate a Chinese product optimization report.

## Fast Path

- Generate the browser collection bundle:
  - `node skills/product-voc-auto-report/scripts/build-browser-voc-bundle.mjs --output <bundle-json>`
- Run the local report flow after browser collection:
  - `node skills/product-voc-auto-report/scripts/run-browser-voc-report.mjs --config skills/product-voc-auto-report/assets/config.example.json`

## Workflow

1. Start from a logged-in seller browser session.
2. Generate `browser-voc-bundle.json`.
3. Open the seller pages defined in the bundle:
   - review page
   - Q&A page
   - complaint/refund page
4. Execute the corresponding `collectScript` on each page through the CDP browser tool.
5. Save each returned JSON array locally.
6. Update the config with the saved JSON paths.
7. Run `run-browser-voc-report.mjs`.
8. Return:
   - local report path
   - total collected records
   - top issues

## Browser-Only Notes

- This skill is intentionally browser-first and does not require official APIs.
- Reuse the same logged-in seller session across all pages.
- If login, captcha, or risk control interrupts collection, ask the merchant to complete it manually and continue in the same session.
- Because seller-console DOM changes over time, keep the extractor scripts generic and be ready to tune selectors when needed.

## Output Shape

The final report should include:

- 总结结论
- 多源高频问题
- 高风险售后问题
- 消费者原声摘要
- 优先级优化建议
- 建议验证动作

## When To Read References

- Read `references/browser-pages.md` when the user asks what pages need to be opened in the seller console or how to map the browser-collected JSON into the report workflow.
