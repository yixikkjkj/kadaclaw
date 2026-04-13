---
name: taobao-buy-advisor
description: Use this skill when the user gives a Taobao product link or product name and wants a buyer-side judgment on whether the product is worth buying based on product details, reviews, and Q&A. Prefer a logged-in browser session for collection when comments or Q&A require login, then summarize strengths, weaknesses, recurring issues, suitable buyers, and a final buy-or-skip verdict.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# Taobao Buy Advisor

Use this skill to turn a Taobao product link or product name into a buyer-oriented decision report.

## Goal

- Collect product details, reviews, and Q&A from a Taobao product page.
- Normalize visible buyer feedback into a structured format.
- Detect recurring strengths, recurring problems, and high-risk issues.
- Judge whether the product is worth buying.
- Return a short verdict plus a readable Markdown report.

## Fast Path

- Build a browser collection bundle:
  - `node skills/taobao-buy-advisor/scripts/build-browser-product-bundle.mjs --url <taobao-item-url>`
  - or:
  - `node skills/taobao-buy-advisor/scripts/build-browser-product-bundle.mjs --keyword <product-name>`
- Analyze a collected product JSON:
  - `node skills/taobao-buy-advisor/scripts/analyze-product-sentiment.mjs --input <product-json> --output <analysis-json>`
- Generate a readable report:
  - `node skills/taobao-buy-advisor/scripts/generate-buy-advice.mjs --input <analysis-json> --output <report-md>`
- Run the full local reporting flow on collected JSON:
  - `node skills/taobao-buy-advisor/scripts/run-buy-advisor.mjs --input <product-json> --output-dir <dir>`

## Workflow

1. Identify the input:
   - product URL is preferred
   - product name is acceptable, but confirm the target product in search results before collecting
2. Generate the browser bundle with `build-browser-product-bundle.mjs`.
3. Use a logged-in browser session:
   - open the item page directly when a URL is provided
   - or open the search page and let the user confirm the right product before entering the item page
4. Execute the returned `collectScript` on the product page.
5. Save the collected JSON locally.
6. Run `run-buy-advisor.mjs` on the collected JSON.
7. Return:
   - verdict
   - total score
   - main reasons to buy
   - main reasons to avoid
   - suitable buyers
   - risky buyers
   - output file paths

## Output Shape

The final answer should include:

- one-line verdict: `值得买` / `谨慎买` / `不推荐`
- total score out of `100`
- key strengths
- key weaknesses
- repeated risk issues
- what kind of buyer it suits
- what kind of buyer should avoid it
- a short bottom-line conclusion

## Decision Rules

- Focus on repeated evidence, not isolated praise or isolated complaints.
- Distinguish mild flaws from purchase-breaking flaws.
- Treat repeated issues like `异味`, `漏水`, `掉色`, `尺寸严重不符`, `噪音大`, `做工差`, `假货嫌疑` as high risk.
- Use Q&A to answer practical questions such as:
  - size
  - material
  - compatibility
  - durability
  - whether major defects are expected
- If feedback is mixed, prefer `谨慎买` over overconfident conclusions.

## When To Read References

- Read `references/verdict-rubric.md` when the user asks how the verdict is scored or wants to tune the buy/no-buy threshold.

## Notes

- Use a logged-in browser session when reviews or Q&A are not fully visible without login.
- Do not pretend that one page of comments is enough for statistical certainty. State uncertainty if the visible sample is thin.
- Product-name input requires confirmation because Taobao search results often contain near-duplicate items.
- If the page has multiple variants, mention that comments may mix different SKUs unless the page clearly separates them.
