import fs from "node:fs";

const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const readScript = (filename) =>
  fs.readFileSync(new URL(`./${filename}`, import.meta.url), "utf8");

const wrapFunctionBody = (body, { async = false } = {}) =>
  `${async ? "async " : ""}() => {\n${body}\n}`;

const buildTaobaoInjectScript = (reviewLimit = 100, qaLimit = 100) =>
  compactScript(
    readScript("taobao-script.js")
      .replaceAll("__REVIEW_LIMIT__", String(reviewLimit))
      .replaceAll("__QA_LIMIT__", String(qaLimit))
  );

const buildTaobaoInjectFn = () => wrapFunctionBody(buildTaobaoInjectScript());
const buildTaobaoRunFn = () =>
  wrapFunctionBody("return await window.runTaobaoReviewCollection();", { async: true });
const buildTaobaoResultReaderFn = () =>
  wrapFunctionBody("return JSON.stringify(window.__TAOBAO_REVIEW_RESULT__ ?? null);");

const buildBrowserSteps = (openUrl) => [
  {
    action: "navigate",
    url: openUrl,
  },
  {
    action: "evaluate",
    fn: buildTaobaoInjectFn(),
  },
  {
    action: "evaluate",
    fn: buildTaobaoRunFn(),
  },
  {
    action: "evaluate",
    fn: buildTaobaoResultReaderFn(),
  },
];

export const buildTaobaoExtractorBundle = (openUrl) => ({
  platform: "taobao",
  implemented: true,
  extractorType: "dom-script",
  browserSteps: buildBrowserSteps(openUrl),
  collectionPlan: [
    "先 navigate 到 openUrl，确保连接里的浏览器已经有可用 page/tab。",
    "再按顺序执行注入脚本、运行脚本、结果读取脚本。",
    "所有浏览器 evaluate 都传 fn，不要直接传 script 或把表达式误当成 fn。",
    "优先通过查看全部评价和查看全部问答的抽屉采集评论与回答。",
    "保留原始评论文本、问答内容和 runtimeDiagnostics。",
  ],
});
