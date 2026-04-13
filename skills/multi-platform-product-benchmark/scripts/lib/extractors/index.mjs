import { buildTaobaoExtractorBundle } from "./taobao.mjs";

export const buildPlatformExtractorBundle = (platform, competitorCount = 10) => {
  if (platform === "taobao") {
    return buildTaobaoExtractorBundle(competitorCount);
  }

  return {
    platform,
    implemented: false,
    extractorType: "unimplemented",
    targetPageScript: "",
    searchResultsScript: "",
    collectionPlan: [
      `当前仓库只实现了淘宝 DOM 提取器，${platform} 还需要单独适配页面结构。`,
    ],
  };
};
