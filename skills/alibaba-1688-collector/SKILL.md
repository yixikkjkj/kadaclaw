---
name: alibaba-1688-collector
description: Use this skill when the user wants to use a CDP-connected browser to search products on 1688, collect product data from search results, and export the collected data to a local Excel file, especially when login, anti-bot checks, or captcha handling may be required.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# 1688 Product Collector

Use this skill to search 1688 in a CDP-connected browser, collect product data, and save the results into a local Excel file.

## Goal

- Parse the user's collection request.
- Use CDP browser control instead of a stateless fetch-style approach, because 1688 often requires a logged-in browser context.
- Open `https://www.1688.com/`.
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
3. Use the browser tool in CDP mode and keep the existing browser session when possible.
4. Open `https://www.1688.com/`.
5. If 1688 requires login, ask the user to complete login in the opened browser session before continuing.
6. If anti-bot verification, slider verification, SMS verification, or captcha appears, pause and ask the user to handle it in the browser, then continue from the same session.
7. Find the main search box, enter the keyword, and trigger the search.
8. Wait for the results page to stabilize before collecting data.
9. Collect as many rows as needed from the result list. Prefer visible search results first, then continue scrolling if more rows are needed.
10. For each product, collect these fields whenever available:
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
11. Normalize missing values as empty strings instead of inventing content.
12. Create an Excel file locally. The output should be `.xlsx`, not csv, unless xlsx creation is impossible in the current environment.
13. Save the file to a local user-visible directory such as `~/Downloads`.
14. Reply with:
   - the keyword used
   - how many products were collected
   - the local file path
   - any important collection limitations or missing fields

## Defaults

- Default product count: `20`
- Default output directory: `~/Downloads`
- Default file name pattern: `1688-products-<keyword>-<YYYYMMDD-HHmmss>.xlsx`

## Notes

- Prefer direct CDP browser interaction over describing hypothetical scraping steps.
- Reuse the user's logged-in browser session whenever possible.
- Do not fabricate product fields that are not visible on the page.
- If 1688 requires login, verification, or anti-bot interaction, stop and ask the user to assist in the opened browser window, then resume from the same session.
- Do not claim the task can fully avoid login, anti-bot checks, or captcha. This skill assumes those interruptions may happen.
- If the browser can collect the data but local Excel generation needs an extra tool, create the structured data first, then generate the Excel file with the available local toolchain.
- If `.xlsx` cannot be generated, explain why and only fall back to `.csv` after telling the user.
