---
name: taobao-feedback-monitor
description: Use this skill when the user wants to monitor Taobao seller product reviews, negative feedback, follow-up reviews, product Q&A, unanswered questions, or generate daily risk summaries and alerts. Prefer official Taobao Open Platform review APIs, seller-console exports, or authorized seller-session data sources, and avoid unauthorized scraping. This skill also supports CDP-connected browser collection from logged-in seller pages when API access is unavailable.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Taobao Feedback Monitor

Use this skill to build or run a lightweight monitoring workflow for Taobao seller feedback data.

## Goal

- Monitor product reviews and Q&A in one workflow.
- Normalize different source formats into one schema.
- Detect negative feedback, concentrated item-level complaints, and unanswered Q&A.
- Output a JSON summary and a readable Markdown report.
- Send alerts through a webhook when needed.

## Compliance Boundary

- Prefer official review APIs for comments and ratings.
- Prefer seller-console exports or authorized seller-session collection for product Q&A.
- Do not suggest unauthorized scraping as the default path.
- If the user asks for a full automation flow, keep the skill focused on ingestion, analysis, and alerting, and call out where seller authorization is required.

## Fast Path

- Import exported review or Q&A data:
  - `node skills/taobao-feedback-monitor/scripts/import-feedback.mjs --input <file> --source review --output <normalized-json>`
  - `node skills/taobao-feedback-monitor/scripts/import-feedback.mjs --input <file> --source qa --output <normalized-json>`
- Pull reviews from TOP when the seller already has credentials:
  - `node skills/taobao-feedback-monitor/scripts/fetch-reviews.mjs --start-date 2026-04-01 --end-date 2026-04-10 --output <normalized-json>`
- Build a browser collection bundle for a logged-in seller review page:
  - `node skills/taobao-feedback-monitor/scripts/build-browser-review-bundle.mjs --output <bundle-json>`
- Analyze normalized records:
  - `node skills/taobao-feedback-monitor/scripts/analyze-feedback.mjs --input <normalized-json> --output-dir <dir>`
- Send webhook alerts from the analysis result:
  - `node skills/taobao-feedback-monitor/scripts/send-alert.mjs --input <dir>/alerts.json`
- Run the full local workflow:
  - `node skills/taobao-feedback-monitor/scripts/run-monitor.mjs --reviews <reviews-file> --qa <qa-file> --output-dir <dir>`
- Run the config-driven workflow:
  - `node skills/taobao-feedback-monitor/scripts/run-monitor-from-config.mjs --config skills/taobao-feedback-monitor/assets/config.example.json`

## Workflow

1. Identify the source:
   - reviews from TOP API or seller export
   - reviews from a logged-in seller browser session when API access is unavailable
   - Q&A from seller export, manual export, or authorized collection
2. Convert raw records into the normalized schema with `import-feedback.mjs`.
3. If the user already has Taobao TOP credentials, use `fetch-reviews.mjs` for reviews instead of manual exports.
4. If the user needs browser collection, generate the bundle with `build-browser-review-bundle.mjs`, open the seller review page in the existing logged-in browser session, and execute the returned `collectScript`.
5. Save the browser-collected JSON locally and feed it back into `run-monitor.mjs` or `run-monitor-from-config.mjs`.
6. Run `analyze-feedback.mjs` on the normalized data.
7. Review:
   - critical alerts
   - hot items with clustered complaints
   - unanswered Q&A
8. If a webhook is configured, push the alert summary with `send-alert.mjs`.
9. Return:
   - number of imported records
   - number of alerts
   - top risky items
   - output file paths

## Config-Driven Mode

When the user wants a repeatable seller workflow, prefer the config-driven runner:

- put the review export path, Q&A export path, or TOP review settings into one JSON config
- or set review mode to `browser` and let the runner generate a browser bundle plus waiting instructions
- put thresholds and keywords into the same config
- configure `provider` as `feishu` or `dingtalk`
- execute `run-monitor-from-config.mjs` from a scheduler or cron job

Use `assets/config.example.json` as the starting point.

## Normalized Schema

Each normalized record uses this shape:

```json
{
  "id": "string",
  "source": "review | qa",
  "channel": "top-api | csv-import | json-import | manual",
  "itemId": "string",
  "itemTitle": "string",
  "content": "string",
  "rating": 1,
  "createdAt": "2026-04-10T09:00:00.000Z",
  "replyStatus": "replied | pending | unknown",
  "replyContent": "string",
  "userName": "string",
  "raw": {}
}
```

## Defaults

- Negative keywords are defined in `analyze-feedback.mjs`.
- Low-rating threshold: `<= 2`
- Q&A unanswered timeout: `2` hours
- Cluster window: `24` hours
- Cluster threshold: `3` negative records per item

## When To Read References

- Read `references/official-sources.md` when the user asks which Taobao capabilities are official, what the integration boundaries are, or why Q&A ingestion is treated differently from reviews.

## Notes

- TOP API field names and permission scopes vary by app and seller authorization. If a live API call fails, inspect the returned error and adjust the requested fields or method instead of fabricating support.
- Follow-up review support is often weaker than main review support in public APIs. If the user specifically needs follow-up reviews, treat seller-console data as the fallback source.
- Browser collection is a seller-session fallback, not the default integration path. Reuse the existing logged-in browser session and stop for user help if login, captcha, or risk control interrupts the page.
- Keep the monitoring pipeline deterministic: import, normalize, analyze, alert.
