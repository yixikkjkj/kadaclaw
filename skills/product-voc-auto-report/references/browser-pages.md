# Browser Pages

This skill expects the merchant to use a logged-in seller-console browser session.

## Recommended Pages

- Review management page
- Product Q&A management page
- Refund, dispute, or complaint management page

## Practical Rule

If the merchant cannot provide stable page URLs ahead of time, start from the seller home page and navigate manually to each page before executing the corresponding `collectScript`.

## Collection Output

Each page script returns normalized records close to this shape:

```json
{
  "id": "string",
  "source": "review | qa | complaint",
  "channel": "browser",
  "itemId": "string",
  "itemTitle": "string",
  "content": "string",
  "replyContent": "string",
  "rating": 1,
  "createdAt": "2026-04-10T09:00:00.000Z",
  "raw": {}
}
```

That means the browser-collected output can go directly into the reporting flow without calling external APIs.
