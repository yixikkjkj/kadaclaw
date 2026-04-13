---
name: multi-platform-product-benchmark
description: Use this skill when the user wants to input a Douyin, Pinduoduo, Taobao, Tmall, or JD product link, open the product page in the default runtime-provided CDP browser, collect the product's visible information plus page reviews and Q&A, search the same platform for other sellers offering the same item, use reviews and Q&A as the primary analysis input, and export the analysis to a local Excel file.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Multi-Platform Product Benchmark

Use this skill to open one product listing in the default runtime-provided CDP browser, benchmark it against higher-selling same-platform competitors, and export the result to a local `.xlsx` file.

The browser connection is provided by the runtime. Never ask the user to provide CDP connection info such as `ws://...`, host, port, or any custom browser endpoint. Start with the default browser tool/session that is already available.

Reviews and page Q&A are the primary evidence for the final report. Price, sales, ratings, tags, and delivery signals are supporting context only.

DOM extraction must be implemented per platform. The current repository only includes a concrete Taobao extractor. Other platforms may still be accepted as links, but they do not yet have a ready-to-run page extractor script in this skill.

## Fast Path

- Parse the input link and prepare the report bundle:
  - `node skills/multi-platform-product-benchmark/scripts/build_product_benchmark_bundle.mjs <product-url> [competitor-count]`
- After collecting `target` and `competitors` JSON, build the final report:
  - `node skills/multi-platform-product-benchmark/scripts/build_benchmark_report.mjs <input-json|-> <output-xlsx> [output-json]`

## Goal

- Accept one product URL from:
  - Douyin
  - Pinduoduo
  - Taobao
  - Tmall
  - JD
- Detect the platform and normalize the input URL.
- Open the target page in the default runtime-provided CDP browser before any collection.
- Use a logged-in browser session when the platform requires login, verification, or anti-bot handling.
- Collect the visible information for the target product.
- Collect page reviews and page Q&A for the target listing and, when feasible, for the strongest same-item competitors.
- Search the same platform for the same or equivalent item sold by other merchants.
- Prefer high-sales competitors and exclude the target listing itself.
- Compare the target listing against competitors, but make the main report content come from review themes, complaint themes, repeated pre-sale questions, unanswered concerns, and competitor review/Q&A advantages.
- Export the final benchmark report to a local Excel file.

## Workflow

1. Run:
   - `node skills/multi-platform-product-benchmark/scripts/build_product_benchmark_bundle.mjs <product-url> [competitor-count]`
2. Read the returned JSON and confirm:
   - `platform`
   - `normalizedUrl`
   - `openUrl`
   - `domExtractorImplemented`
   - `targetPageScript`
   - `searchResultsScript`
   - `suggestedOutputPath`
   - `recommendedFields`
3. Use the default browser tool/session in CDP mode and keep the existing browser session when possible.
4. Do not ask the user for browser connection details. Open `openUrl` in the default CDP browser session. If the input is a short link or redirect link, allow the browser to finish the redirect before continuing.
5. If login, slider verification, SMS verification, or captcha appears, pause and ask the user to complete it in the same session.
6. Wait for the target product page to stabilize, then collect the target listing's visible fields whenever available:
   - `productTitle`
   - `shopName`
   - `price`
   - `salesText`
   - `reviewCountText`
   - `shopScoreText`
   - `shopTags`
   - `productTags`
   - `couponText`
   - `serviceText`
   - `deliveryText`
   - `shippingFrom`
   - `sellerType`
   - `detailImageCount`
   - `detailTextLength`
   - `sourcePlatformRankText`
   - `livePromotionText`
   - `productUrl`
   - `reviews`
   - `qaPairs`
7. Treat review and Q&A collection as the primary data task:
   - collect recent and high-signal review texts when visible
   - collect negative, neutral, and positive review samples when possible
   - collect page Q&A question and answer pairs
   - preserve raw wording instead of over-summarizing during collection
   - if the platform has separate tabs for `评价` or `问大家` / `问答`, open them in the same browser session and collect from there
8. Build the same-item search query from the target title and structured facts:
   - brand
   - model
   - capacity / size / color / specification
   - official product name if present
9. Search on the same platform only and stay inside the same default CDP browser session. Do not jump to other platforms.
10. Prefer platform-native sales sorting or sales-priority ranking when the UI provides it.
11. Collect competitor listings that appear to sell the same item. Target `10` competitors by default unless the user requests another count.
12. For the strongest competitors, prioritize collecting:
   - competitor review samples
   - competitor complaint themes
   - competitor Q&A topics
   - competitor answer completeness
13. Exclude:
   - the original listing itself
   - listings that are clearly different products
   - ads if they are visibly marked and organic results are available
14. Save the collected payload in this shape:

```json
{
  "context": {
    "platform": "taobao",
    "sourceUrl": "https://item.taobao.com/item.htm?id=123",
    "normalizedUrl": "https://item.taobao.com/item.htm?id=123",
    "searchKeyword": "品牌 型号 规格",
    "collectedAt": "2026-04-13T16:30:00+08:00"
  },
  "target": {
    "platform": "taobao",
    "productTitle": "",
    "shopName": "",
    "price": "",
    "salesText": "",
    "reviewCountText": "",
    "shopScoreText": "",
    "shopTags": "",
    "productTags": "",
    "couponText": "",
    "serviceText": "",
    "deliveryText": "",
    "shippingFrom": "",
    "sellerType": "",
    "detailImageCount": "",
    "detailTextLength": "",
    "sourcePlatformRankText": "",
    "livePromotionText": "",
    "productUrl": "",
    "reviews": [
      {
        "text": "",
        "rating": "",
        "tag": "",
        "isNegative": false
      }
    ],
    "qaPairs": [
      {
        "question": "",
        "answer": ""
      }
    ]
  },
  "competitors": [
    {
      "platform": "taobao",
      "productTitle": "",
      "shopName": "",
      "price": "",
      "salesText": "",
      "reviewCountText": "",
      "shopScoreText": "",
      "shopTags": "",
      "productTags": "",
      "couponText": "",
      "serviceText": "",
      "deliveryText": "",
      "shippingFrom": "",
      "sellerType": "",
      "detailImageCount": "",
      "detailTextLength": "",
      "sourcePlatformRankText": "",
      "livePromotionText": "",
      "productUrl": "",
      "reviews": [],
      "qaPairs": []
    }
  ]
}
```

15. Build the report:
   - `node skills/multi-platform-product-benchmark/scripts/build_benchmark_report.mjs <input-json|-> <output-xlsx> [output-json]`
16. In the final report, order the output by priority:
   - review-based conclusions
   - Q&A-based conclusions
   - supporting listing-level signals such as price, sales, service, and trust tags
17. Reply with:
   - detected platform
   - target listing title
   - competitor count used
   - local Excel path
   - any missing review / Q&A fields or collection limitations

## Defaults

- Default competitor count: `10`
- Default output directory: `~/Downloads`
- Default file name pattern: `<platform>-product-benchmark-<YYYYMMDD-HHmmss>.xlsx`

## Notes

- Use only visible, publicly displayed information from the active browser session.
- Prefer direct CDP browser interaction over describing hypothetical navigation steps.
- The default CDP browser/session is part of the environment. Do not request `ws://...`, port numbers, or any manual connection string from the user.
- Reuse the user's logged-in browser session whenever possible.
- Do not pretend one DOM script can cover all platforms. Extractors must be split by platform.
- The current skill ships a Taobao DOM extractor first. Extend other platforms by adding their own extractor files instead of patching Taobao selectors into a fake universal script.
- Prefer preserving raw review text and raw Q&A text in the collected payload, then summarize later in the report step.
- If review and Q&A data are available, they should dominate the analysis. Do not let price-only or sales-only heuristics become the main report.
- Do not claim hidden data, private GMV, or platform-internal traffic sources unless the user provides them.
- Do not promise a no-login flow. These platforms often require a live logged-in browser session.
- Do not fabricate sales reasons when evidence is missing. State that the conclusion is based on visible listing signals.
- Prefer exporting `.xlsx`. Only fall back to `.csv` if `.xlsx` generation fails in the current environment.
- When the product link is a short link or redirect link, keep the original URL in `context.sourceUrl` and the resolved or cleaned URL in `context.normalizedUrl` when available.
- If login, verification, or anti-bot interaction blocks page access, stop and ask the user to handle it in the opened browser window, then resume from the same session.
