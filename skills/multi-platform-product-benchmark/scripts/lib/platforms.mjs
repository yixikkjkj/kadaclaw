import path from "node:path";

const SUPPORTED_PLATFORMS = {
  douyin: ["douyin.com", "iesdouyin.com"],
  pinduoduo: ["pinduoduo.com", "yangkeduo.com"],
  taobao: ["taobao.com"],
  tmall: ["tmall.com"],
  jd: ["jd.com", "3.cn"],
};

const PREFERRED_QUERY_KEYS = {
  douyin: ["id", "product_id"],
  pinduoduo: ["goods_id", "goodsId"],
  taobao: ["id"],
  tmall: ["id"],
  jd: ["sku"],
};

export const detectPlatform = (url) => {
  const host = new URL(url).hostname.toLowerCase();

  for (const [platform, domains] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return platform;
    }
  }

  throw new Error("暂不支持该商品链接，当前仅支持抖音、拼多多、淘宝、天猫、京东。");
};

const extractProductId = (platform, parsedUrl) => {
  const preferredKeys = PREFERRED_QUERY_KEYS[platform] ?? [];
  for (const key of preferredKeys) {
    const value = parsedUrl.searchParams.get(key)?.trim() ?? "";
    if (value) {
      return value;
    }
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  for (const part of [...pathParts].reverse()) {
    const normalized = part.replace(/\.html$/i, "");
    if (/^\d+$/.test(normalized)) {
      return normalized;
    }
  }

  return "";
};

export const normalizeProductUrl = (url) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new Error("商品链接格式无效，请提供完整的 http 或 https 链接。");
  }

  const platform = detectPlatform(parsedUrl.href);
  const preferredKeys = PREFERRED_QUERY_KEYS[platform] ?? [];
  const normalizedUrl = new URL(parsedUrl.href);
  const nextSearch = new URLSearchParams();

  for (const key of preferredKeys) {
    const value = parsedUrl.searchParams.get(key)?.trim() ?? "";
    if (value) {
      nextSearch.set(key, value);
    }
  }

  normalizedUrl.search = nextSearch.toString();
  normalizedUrl.hash = "";

  return {
    platform,
    originalUrl: url,
    normalizedUrl: normalizedUrl.toString(),
    host: parsedUrl.hostname.toLowerCase(),
    productId: extractProductId(platform, parsedUrl),
  };
};

export const buildDefaultOutputPath = (platform, directory = "~/Downloads") => {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") +
    "-" +
    [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
  const baseDirectory = directory.startsWith("~/")
    ? path.join(process.env.HOME ?? "", directory.slice(2))
    : directory;
  return path.join(baseDirectory, `${platform}-product-benchmark-${timestamp}.xlsx`);
};
