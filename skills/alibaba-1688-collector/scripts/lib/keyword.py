from urllib.parse import quote_from_bytes


def encode_keyword_to_gbk_percent(keyword: str) -> str:
    return quote_from_bytes(keyword.encode("gbk"))


def build_1688_search_url(keyword: str) -> str:
    return (
        "https://s.1688.com/selloffer/offer_search.htm"
        f"?keywords={encode_keyword_to_gbk_percent(keyword)}"
    )
