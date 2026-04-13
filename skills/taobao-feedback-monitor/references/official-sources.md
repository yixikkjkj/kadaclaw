# Official Sources

This skill is designed around the current official Taobao and Alibaba Open Platform boundaries that were verified during setup.

## Reviews

- Public review APIs exist on Alibaba Open Platform for seller review access.
- Relevant method names that appeared in current official search results include:
  - `taobao.traderates.get`
  - `taobao.traderates.search`
- Official review documentation indicates:
  - some review interfaces only cover the recent 180 days
  - seller-side public APIs may expose main reviews while follow-up reviews may still require seller-console access

## Product Q&A

- A stable, clearly public, general-purpose seller API for Taobao product Q&A was not confirmed in the official search results used for this setup.
- Treat this as an official-capability gap unless the seller has access to a private or partner-specific capability.
- Because of that, this skill handles Q&A through seller exports, authorized session collection, or manual imports rather than assuming an open API exists.

## Message Subscription

- Taobao has official message-service capability, but this skill does not assume review or Q&A topics are available for every seller use case.
- Use polling for reviews by default unless a confirmed subscription topic is available in the user's app context.

## Recommended Integration Split

- Reviews:
  - first choice: TOP API
  - second choice: seller export
- Q&A:
  - first choice: seller export or authorized seller-side workflow
  - second choice: manual JSON or CSV import

## Why This Skill Is Structured This Way

- It keeps the solution compliant.
- It avoids blocking the user on one missing API.
- It lets the user prove value quickly with exports, then upgrade the review side to an official API later.
