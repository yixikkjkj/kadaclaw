#!/usr/bin/env python3

import json
import sys

from lib.browser_extract import build_scroll_and_extract_products_script
from lib.keyword import build_1688_search_url, encode_keyword_to_gbk_percent


def compact_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def parse_int(index: int, default: int) -> int:
    try:
        value = int(sys.argv[index]) if len(sys.argv) > index else default
    except ValueError:
        value = default

    return value if value > 0 else default


def main() -> int:
    keyword = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    if not keyword:
        print(
            "Usage: python3 skills/alibaba-1688-collector/scripts/build_1688_collection_bundle.py <keyword> [count] [scroll-rounds] [delay-ms]",
            file=sys.stderr,
        )
        return 1

    limit = parse_int(2, 20)
    scroll_rounds = parse_int(3, 4)
    scroll_delay_ms = parse_int(4, 900)

    print(
        compact_json(
            {
                "keyword": keyword,
                "encodedKeyword": encode_keyword_to_gbk_percent(keyword),
                "searchUrl": build_1688_search_url(keyword),
                "collectScript": build_scroll_and_extract_products_script(
                    limit,
                    scroll_rounds,
                    scroll_delay_ms,
                    keyword,
                ),
                "defaults": {
                    "count": limit,
                    "scrollRounds": scroll_rounds,
                    "scrollDelayMs": scroll_delay_ms,
                },
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
