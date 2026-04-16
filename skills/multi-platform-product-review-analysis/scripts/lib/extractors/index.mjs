import { buildTaobaoExtractorBundle } from "./taobao.mjs";

export const buildPlatformExtractorBundle = (platform, openUrl) => {
  if (platform === "taobao") {
    return buildTaobaoExtractorBundle(openUrl);
  }

  return {
    platform,
    implemented: false,
    extractorType: "unimplemented",
    browserSteps: [
      {
        action: "navigate",
        url: openUrl,
      },
    ],
    collectionPlan: [
      "先 navigate 到 openUrl，确保连接里的浏览器已经有可用 page/tab。",
      `当前仓库只实现了淘宝 DOM 提取器，${platform} 还需要单独适配页面结构。`,
    ],
  };
};
