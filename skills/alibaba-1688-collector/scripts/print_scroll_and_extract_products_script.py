#!/usr/bin/env python3

import sys

from lib.browser_extract import build_scroll_and_extract_products_script


def parse_int(index: int, default: int) -> int:
    try:
        value = int(sys.argv[index]) if len(sys.argv) > index else default
    except ValueError:
        value = default

    return value if value >= 0 else default


def main() -> int:
    limit = parse_int(1, 20)
    scroll_rounds = parse_int(2, 4)
    scroll_delay_ms = parse_int(3, 900)

    if limit <= 0:
        limit = 20

    print(build_scroll_and_extract_products_script(limit, scroll_rounds, scroll_delay_ms))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
