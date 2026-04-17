import fs from "node:fs";

const MAX_EVALUATE_SOURCE_LENGTH = 1800;

const compactScript = (script) =>
  script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const readScript = (filename) => fs.readFileSync(new URL(`./${filename}`, import.meta.url), "utf8");

const wrapFunctionBody = (body, { async = false } = {}) =>
  `${async ? "async " : ""}() => {\n${body}\n}`;

const buildTaobaoInjectScript = (reviewLimit = 100, qaLimit = 100) =>
  compactScript(
    readScript("taobao-script.js")
      .replaceAll("__REVIEW_LIMIT__", String(reviewLimit))
      .replaceAll("__QA_LIMIT__", String(qaLimit)),
  );

const chunkText = (value, maxLength = MAX_EVALUATE_SOURCE_LENGTH) => {
  const chunks = [];
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }
  return chunks;
};

const buildNavigateStep = (url) => ({
  action: "navigate",
  kind: "navigate",
  url,
});

const buildEvaluateStep = (fn, extra = {}) => ({
  action: "evaluate",
  kind: "evaluate",
  fn,
  ...extra,
});

const buildTaobaoBufferInitFn = () =>
  wrapFunctionBody(
    ['window.__TAOBAO_EXTRACTOR_SOURCE__ = "";', "return { initialized: true };"].join("\n"),
  );

const buildTaobaoChunkAppendFn = (chunk, chunkIndex, chunkCount) =>
  wrapFunctionBody(
    [
      `window.__TAOBAO_EXTRACTOR_SOURCE__ = (window.__TAOBAO_EXTRACTOR_SOURCE__ ?? "") + ${JSON.stringify(chunk)};`,
      "return {",
      `  chunkIndex: ${chunkIndex + 1},`,
      `  chunkCount: ${chunkCount},`,
      '  sourceLength: (window.__TAOBAO_EXTRACTOR_SOURCE__ ?? "").length,',
      "};",
    ].join("\n"),
  );

const buildTaobaoLoaderFn = () =>
  wrapFunctionBody(
    [
      'const source = window.__TAOBAO_EXTRACTOR_SOURCE__ ?? "";',
      'if (!source) { throw new Error("淘宝提取脚本为空，无法注入。"); }',
      "(0, eval)(source);",
      "return {",
      '  loaded: typeof window.runTaobaoReviewCollection === "function",',
      "  sourceLength: source.length,",
      "};",
    ].join("\n"),
  );

const buildTaobaoRunFn = () =>
  wrapFunctionBody("return await window.runTaobaoReviewCollection();", { async: true });
const buildTaobaoResultReaderFn = () =>
  wrapFunctionBody("return JSON.stringify(window.__TAOBAO_REVIEW_RESULT__ ?? null);");

const buildBrowserSteps = (openUrl) => {
  const scriptChunks = chunkText(buildTaobaoInjectScript());
  const chunkCount = scriptChunks.length;

  return [
    buildNavigateStep(openUrl),
    buildEvaluateStep(buildTaobaoBufferInitFn(), {
      name: "init-extractor-buffer",
    }),
    ...scriptChunks.map((chunk, index) =>
      buildEvaluateStep(buildTaobaoChunkAppendFn(chunk, index, chunkCount), {
        name: `append-extractor-chunk-${index + 1}`,
        chunkIndex: index + 1,
        chunkCount,
      }),
    ),
    buildEvaluateStep(buildTaobaoLoaderFn(), {
      name: "load-extractor",
    }),
    buildEvaluateStep(buildTaobaoRunFn(), {
      name: "run-extractor",
    }),
    buildEvaluateStep(buildTaobaoResultReaderFn(), {
      name: "read-result",
    }),
  ];
};

export const buildTaobaoExtractorBundle = (openUrl) => ({
  platform: "taobao",
  implemented: true,
  extractorType: "chunked-dom-script",
  browserSteps: buildBrowserSteps(openUrl),
  collectionPlan: [
    "先 navigate 到 openUrl，确保连接里的浏览器已经有可用 page/tab。",
    "再按顺序执行初始化缓存、分片注入脚本、加载脚本、运行脚本、读取结果。",
    "所有浏览器 evaluate 都传 fn，且每一步都保留 kind=evaluate。",
    "优先通过查看全部评价和查看全部问答的抽屉采集评论与回答。",
    "保留原始评论文本、问答内容和 runtimeDiagnostics。",
  ],
});
