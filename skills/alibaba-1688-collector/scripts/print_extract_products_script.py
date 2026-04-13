#!/usr/bin/env python3

import sys

from lib.browser_extract import build_extract_products_script


def main() -> int:
    try:
        limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    except ValueError:
        limit = 20

    if limit <= 0:
        limit = 20

    print(build_extract_products_script(limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
