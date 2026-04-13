#!/usr/bin/env python3

import json
import sys

from lib.keyword import encode_keyword_to_gbk_percent


def compact_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    keyword = " ".join(sys.argv[1:]).strip()
    if not keyword:
        print(
            "Usage: python3 skills/alibaba-1688-collector/scripts/encode_1688_keyword.py <keyword>",
            file=sys.stderr,
        )
        return 1

    print(
        compact_json(
            {
                "keyword": keyword,
                "encodedKeyword": encode_keyword_to_gbk_percent(keyword),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
