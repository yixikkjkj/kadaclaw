---
name: alibaba-1688-collector
description: Use this skill when the user wants to use a CDP-connected browser to search products on 1688, collect product data from search results, and export the collected data to a local Excel file, especially when login, anti-bot checks, or captcha handling may be required.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# 1688 Product Collector

Use this skill to search 1688 in a CDP-connected browser, collect product data, and save the results into a local Excel file.

## Fast Path

- Default command:
  - `python3 skills/alibaba-1688-collector/scripts/build_1688_collection_bundle.py <keyword> [count] [scroll-rounds] [delay-ms]`
- It returns compact JSON with:
  - `keyword`
  - `encodedKeyword`
  - `searchUrl`
  - `collectScript`
- Export collected JSON with:
  - `python3 skills/alibaba-1688-collector/scripts/save_products_to_xlsx.py <input-json> <output-xlsx>`
  - or pipe directly:
  - `python3 skills/alibaba-1688-collector/scripts/save_products_to_xlsx.py - <output-xlsx>`
- Fallback helpers only when needed:
  - `python3 skills/alibaba-1688-collector/scripts/build_1688_search_url.py <keyword>`
  - `python3 skills/alibaba-1688-collector/scripts/encode_1688_keyword.py <keyword>`
  - `python3 skills/alibaba-1688-collector/scripts/print_extract_products_script.py <count>`
  - `python3 skills/alibaba-1688-collector/scripts/print_scroll_and_extract_products_script.py <count> <scroll-rounds> <delay-ms>`

## Goal

- Parse the user's collection request.
- Use CDP browser control instead of a stateless fetch-style approach, because 1688 often requires a logged-in browser context.
- Prefer script-driven DOM extraction over snapshot-driven reading.
- Prefer the bundled fast path so URL generation and collection script generation happen once.
- Convert the keyword into GBK percent-encoded form and open the direct search URL:
  - `https://s.1688.com/selloffer/offer_search.htm?keywords=<gbk-encoded-keyword>`
- Fill the search box with the requested keyword and execute the search.
- Collect product data from the search results page.
- Create an Excel file with the collected data.
- Save the file to the user's local machine and tell the user the saved path.

## Workflow

1. Read the user request and extract:
   - search keyword
   - expected number of products
   - any extra filters such as price range, region, source factory, or sorting preference
2. If the keyword is missing, ask for it before using the browser.
3. Prefer `python3 skills/alibaba-1688-collector/scripts/build_1688_collection_bundle.py <keyword> <count>` so the direct search URL and the browser collection script are generated together in one compact response.
4. Use the browser tool in CDP mode and keep the existing browser session when possible.
5. Open the generated `searchUrl`, for example:
   - `https://s.1688.com/selloffer/offer_search.htm?keywords=%B5%ED%B7%DB%B3%A6`
6. If 1688 requires login, ask the user to complete login in the opened browser session before continuing.
7. If anti-bot verification, slider verification, SMS verification, or captcha appears, pause and ask the user to handle it in the browser, then continue from the same session.
8. Wait for the results page to stabilize before collecting data.
9. Prefer browser script execution instead of visual snapshot parsing:
   - execute the bundled `collectScript` inside the current 1688 results page through the browser/CDP tool
   - the fast script already includes incremental scrolling, deduplication, and next-page fallback
10. If the direct URL does not land on the expected result page, reuse the same browser session and fall back to filling the search box manually.
11. Only if the bundled script is unavailable, use the older helper flow:
   - `python3 skills/alibaba-1688-collector/scripts/print_extract_products_script.py <count>`
   - if that returns too few rows, then run `python3 skills/alibaba-1688-collector/scripts/print_scroll_and_extract_products_script.py <count> <scroll-rounds> <delay-ms>`
12. Prefer piping the collected JSON directly into:
   - `python3 skills/alibaba-1688-collector/scripts/save_products_to_xlsx.py - <output-xlsx>`
   If piping is inconvenient, save the collected JSON to a local temp file, then run:
   - `python3 skills/alibaba-1688-collector/scripts/save_products_to_xlsx.py <input-json> <output-xlsx>`
13. For each product, collect these fields whenever available:
   - keyword
   - product title
   - price
   - price unit or price range text
   - minimum order quantity
   - seller or shop name
   - seller location
   - product url
   - product image url
   - any detected tags such as 源头工厂, 实力商家, 包邮, 回头率
14. Normalize missing values as empty strings instead of inventing content.
15. Create an Excel file locally. The output should be `.xlsx`, not csv, unless xlsx creation is impossible in the current environment.
16. Save the file to a local user-visible directory such as `~/Downloads`.
17. Reply with:
   - the keyword used
   - the GBK-encoded keyword
   - how many products were collected
   - the local file path
   - any important collection limitations or missing fields

## Defaults

- Default product count: `20`
- Default scroll rounds: `4`
- Default scroll delay: `900ms`
- Default output directory: `~/Downloads`
- Default file name pattern: `1688-products-<keyword>-<YYYYMMDD-HHmmss>.xlsx`

## Notes

- Prefer direct CDP browser interaction over describing hypothetical scraping steps.
- Reuse the user's logged-in browser session whenever possible.
- Prefer script-driven extraction from DOM over snapshot reading whenever browser script execution is available.
- Prefer the bundled collector script over separate extract-then-scroll tool calls.
- Prefer compact command output over pretty-printed JSON to reduce tool latency.
- Do not fabricate product fields that are not visible on the page.
- If 1688 requires login, verification, or anti-bot interaction, stop and ask the user to assist in the opened browser window, then resume from the same session.
- Do not claim the task can fully avoid login, anti-bot checks, or captcha. This skill assumes those interruptions may happen.
- If the browser can collect the data but local Excel generation needs an extra tool, create the structured data first, then generate the Excel file with the available local toolchain.
- If `.xlsx` cannot be generated, explain why and only fall back to `.csv` after telling the user.
