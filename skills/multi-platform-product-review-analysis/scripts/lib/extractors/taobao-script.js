window.TASK = {
  reviewLimit: __REVIEW_LIMIT__,
  qaLimit: __QA_LIMIT__,
};

window.normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
window.wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
window.getVisibleText = (node) =>
  window.normalizeText(node?.innerText ?? node?.textContent ?? "");
window.waitForDocumentReady = async (timeoutMs = 10000) => {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    return document.readyState;
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timer);
      document.removeEventListener("readystatechange", handleStateChange);
      window.removeEventListener("load", handleLoad);
      resolve(document.readyState);
    };
    const handleStateChange = () => {
      if (document.readyState === "interactive" || document.readyState === "complete") {
        finish();
      }
    };
    const handleLoad = () => finish();
    document.addEventListener("readystatechange", handleStateChange);
    window.addEventListener("load", handleLoad, { once: true });
    const timer = window.setTimeout(() => finish(), timeoutMs);
  });
};
window.isVisible = (node) => {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
};
window.clickElement = async (node) => {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  node.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  await window.wait(250);
  node.focus?.();
  node.click();
  await window.wait(1200);
  return true;
};
window.pickText = (root, selectors) => {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const text = window.normalizeText(node?.textContent ?? "");
    if (text) {
      return text;
    }
  }
  return "";
};
window.pickTexts = (root, selectors) => {
  const result = [];
  const seen = new Set();
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = window.normalizeText(node.textContent ?? "");
      if (text && !seen.has(text)) {
        seen.add(text);
        result.push(text);
      }
    }
  }
  return result;
};
window.asSelectorList = (selectors) => {
  if (Array.isArray(selectors)) {
    return selectors.filter((item) => typeof item === "string" && item.trim());
  }
  if (typeof selectors === "string" && selectors.trim()) {
    return selectors
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};
window.asSelectorText = (selectors) => window.asSelectorList(selectors).join(",");
window.getClassNameText = (node) => {
  const className = node?.className;
  if (typeof className === "string") {
    return className;
  }
  if (className && typeof className.baseVal === "string") {
    return className.baseVal;
  }
  return "";
};

window.BUTTON_LIKE_SELECTORS = [
  "button",
  "a",
  "[role=button]",
  "[tabindex]",
  "[class*=btn]",
  "[class*=Btn]",
  "[class*=button]",
  "[class*=Button]",
  "div",
  "span",
  "li",
].join(",");

window.REVIEW_TRIGGER_KEYWORDS = ["查看全部评价", "全部评价", "宝贝评价", "商品评价", "累计评价"];
window.QA_TRIGGER_KEYWORDS = ["查看全部问答", "全部问答", "商品问答", "宝贝问答", "问大家"];
window.REVIEW_CONTAINER_SELECTORS = [
  "[class*=Comment]",
  "[class*=comment]",
  "[class*=Review]",
  "[class*=review]",
  "[class*=rate]",
  "[data-testid*=review]",
];
window.QA_CONTAINER_SELECTORS = [
  "[class*=qaListContainer]",
  "[class*=qaList]",
  "[class*=questionList]",
  "[class*=askList]",
  "[data-testid*=qa]",
];
window.REVIEW_ITEM_SELECTORS = [
  "[class*=Comment]",
  "[class*=reviewItem]",
  "[class*=rateItem]",
  "[class*=commentItem]",
  "[class*=ReviewItem]",
  "[class*=commentCard]",
  "[class*=reviewCard]",
  "[class*=feedItem]",
  "[data-testid*=review]",
];
window.QA_ITEM_SELECTORS = [
  "[class*=qaItem]",
  "[class*=questionItem]",
  "[class*=askItem]",
  "[class*=QaItem]",
  "[data-testid*=question]",
];

window.getRuntimeBridge = () => {
  if (!window.__productReviewAnalysis) {
    window.__productReviewAnalysis = {
      events: [],
      lastMatchedSelector: "",
      diagnostics: {},
    };
  }
  return window.__productReviewAnalysis;
};
window.recordRuntimeEvent = (type, detail = "") => {
  const bridge = window.getRuntimeBridge();
  bridge.lastEvent = type;
  bridge.lastDetail = detail;
  bridge.events.push({
    type,
    detail,
    timestamp: Date.now(),
  });
  if (bridge.events.length > 20) {
    bridge.events.shift();
  }
};
window.updateDiagnosticStage = (stage, patch = {}) => {
  const bridge = window.getRuntimeBridge();
  bridge.diagnostics[stage] = {
    ...(bridge.diagnostics[stage] ?? {}),
    ...patch,
  };
};
window.findFirstVisible = (root, selectors) => {
  for (const selector of window.asSelectorList(selectors)) {
    const node = root.querySelector(selector);
    if (node instanceof HTMLElement && window.isVisible(node)) {
      return { node, selector };
    }
  }
  return null;
};
window.waitForSelectors = async (root, selectors, timeoutMs = 6000) => {
  const targetRoot =
    root instanceof HTMLElement || root instanceof Document ? root : document;
  const immediate = window.findFirstVisible(targetRoot, selectors);
  if (immediate) {
    window.recordRuntimeEvent("selector-ready", immediate.selector);
    return immediate.node;
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (node, selector = "") => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timer);
      observer.disconnect();
      if (selector) {
        window.getRuntimeBridge().lastMatchedSelector = selector;
        window.recordRuntimeEvent("selector-ready", selector);
      }
      resolve(node);
    };

    const observer = new MutationObserver(() => {
      const found = window.findFirstVisible(targetRoot, selectors);
      if (found) {
        finish(found.node, found.selector);
      }
    });

    const observedNode =
      targetRoot instanceof Document ? targetRoot.documentElement ?? document.body : targetRoot;

    observer.observe(observedNode, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
};
window.findClickableByKeywords = (root, keywords) =>
  Array.from(root.querySelectorAll(window.BUTTON_LIKE_SELECTORS))
    .filter((node) => node instanceof HTMLElement)
    .filter((node) => window.isVisible(node))
    .filter((node) => {
      const text = window.getVisibleText(node);
      return text && keywords.some((keyword) => text.includes(keyword));
    })
    .filter((node) => window.getVisibleText(node).length <= 120)
    .sort((left, right) => {
      const leftText = window.getVisibleText(left);
      const rightText = window.getVisibleText(right);
      const leftSemantic = Number(
        left.matches(
          "button, a, [role=button], [tabindex], [class*=btn], [class*=Btn], [class*=button], [class*=Button]"
        )
      );
      const rightSemantic = Number(
        right.matches(
          "button, a, [role=button], [tabindex], [class*=btn], [class*=Btn], [class*=button], [class*=Button]"
        )
      );
      if (leftSemantic !== rightSemantic) {
        return rightSemantic - leftSemantic;
      }
      return leftText.length - rightText.length;
    });
window.getKeywordCandidatePreview = (root, keywords, limit = 5) =>
  window
    .findClickableByKeywords(root, keywords)
    .slice(0, limit)
    .map((node) => window.getVisibleText(node));
window.waitForClickableByKeywords = async (root, keywords, timeoutMs = 6000) => {
  const targetRoot =
    root instanceof HTMLElement || root instanceof Document ? root : document;
  const immediate = window.findClickableByKeywords(targetRoot, keywords)[0];
  if (immediate) {
    window.recordRuntimeEvent("button-ready", window.getVisibleText(immediate));
    return immediate;
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (node) => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timer);
      observer.disconnect();
      if (node) {
        window.recordRuntimeEvent("button-ready", window.getVisibleText(node));
      }
      resolve(node);
    };

    const observer = new MutationObserver(() => {
      const found = window.findClickableByKeywords(targetRoot, keywords)[0];
      if (found) {
        finish(found);
      }
    });

    const observedNode =
      targetRoot instanceof Document ? targetRoot.documentElement ?? document.body : targetRoot;

    observer.observe(observedNode, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
};
window.stepScroll = (target) => {
  if (target === document.body || target === document.documentElement) {
    const viewportHeight = window.innerHeight || 800;
    const nextTop = window.scrollY + Math.max(viewportHeight * 0.75, 320);
    window.scrollTo({ top: nextTop, behavior: "smooth" });
    return;
  }

  const containerHeight = target.clientHeight || 600;
  const nextTop = target.scrollTop + Math.max(containerHeight * 0.75, 240);
  target.scrollTo({ top: nextTop, behavior: "smooth" });
};
window.smartScrollIfNeeded = async (container = document.documentElement, rounds = 4, delayMs = 900) => {
  const target = container instanceof HTMLElement ? container : document.documentElement;
  for (let index = 0; index < rounds; index += 1) {
    window.stepScroll(target);
    await window.wait(delayMs);
  }
};
window.getOverlayCandidates = () =>
  Array.from(
    document.querySelectorAll([
      "[role=dialog]",
      "[class*=drawer]",
      "[class*=Drawer]",
      "[class*=popup]",
      "[class*=Popup]",
      "[class*=modal]",
      "[class*=Modal]",
      "[class*=overlay]",
      "[class*=Overlay]",
    ].join(","))
  )
    .filter((node) => node instanceof HTMLElement)
    .filter((node) => window.isVisible(node))
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
    });
window.waitForOverlay = async (beforeNodes = [], timeoutMs = 6000) => {
  const startedAt = Date.now();
  const beforeSet = new Set(beforeNodes);
  while (Date.now() - startedAt < timeoutMs) {
    const candidates = window.getOverlayCandidates();
    const newer = candidates.find((node) => !beforeSet.has(node));
    if (newer) {
      return newer;
    }
    if (candidates.length) {
      return candidates[0];
    }
    await window.wait(200);
  }
  return null;
};
window.findDrawerRoot = (preferredRoot) => {
  if (
    preferredRoot instanceof HTMLElement &&
    preferredRoot.matches("[class*=Drawer], [class*=drawer]")
  ) {
    return preferredRoot;
  }
  return (
    window
      .getOverlayCandidates()
      .find((node) => node.matches("[class*=Drawer], [class*=drawer]")) ??
    preferredRoot ??
    null
  );
};
window.openOverlayByKeywords = async (keywords) => {
  const beforeNodes = window.getOverlayCandidates();
  window.updateDiagnosticStage("overlay", {
    targetKeywords: keywords,
    beforeOverlayCount: beforeNodes.length,
    buttonCandidates: window.getKeywordCandidatePreview(document, keywords),
  });
  await window.waitForClickableByKeywords(document, keywords, 6000);
  const candidates = window.findClickableByKeywords(document, keywords);
  for (const candidate of candidates) {
    window.recordRuntimeEvent("click-target", window.getVisibleText(candidate));
    await window.clickElement(candidate);
    const drawer = window.findDrawerRoot(await window.waitForOverlay(beforeNodes, 1800));
    if (drawer) {
      window.recordRuntimeEvent("drawer-opened", window.getClassNameText(drawer));
      window.updateDiagnosticStage("overlay", {
        opened: true,
        matchedButtonText: window.getVisibleText(candidate),
        drawerClassName: window.getClassNameText(drawer),
      });
      return drawer;
    }
  }
  window.updateDiagnosticStage("overlay", {
    opened: false,
    matchedButtonText: "",
  });
  return null;
};
window.scrollContainer = async (container, rounds = 4, delayMs = 900) => {
  const target =
    container instanceof HTMLElement ? container : document.scrollingElement || document.body;
  for (let index = 0; index < rounds; index += 1) {
    window.stepScroll(target);
    await window.wait(delayMs);
  }
};
window.clickAllByKeywords = async (root, keywords) => {
  const clickedNodes = new WeakSet();
  let clickedCount = 0;
  while (true) {
    const target = window
      .findClickableByKeywords(root, keywords)
      .find((node) => !clickedNodes.has(node));
    if (!target) {
      break;
    }
    clickedNodes.add(target);
    clickedCount += 1;
    window.recordRuntimeEvent("click-all-target", window.getVisibleText(target));
    await window.clickElement(target);
    await window.wait(300);
  }
  return clickedCount;
};
window.collectTexts = (root, selectors) => {
  const result = [];
  const seen = new Set();
  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || !window.isVisible(node)) {
        continue;
      }
      const text = window.getVisibleText(node);
      if (text && !seen.has(text)) {
        seen.add(text);
        result.push(text);
      }
    }
  }
  return result;
};
window.pickLongestText = (values, minLength = 6, maxLength = 600) => {
  const candidates = values
    .map((value) => window.normalizeText(value))
    .filter((value) => value.length >= minLength && value.length <= maxLength)
    .filter((value) => !["查看全部评价", "查看全部问答", "查看全部回答"].includes(value))
    .sort((left, right) => right.length - left.length);
  return candidates[0] ?? "";
};
window.uniqueJoin = (values, delimiter = " | ", maxCount = 4) => {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = window.normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxCount) {
      break;
    }
  }
  return result.join(delimiter);
};
window.extractReviewText = (node) => {
  const directCandidates = window.collectTexts(node, [
    "[class*=content]",
    "[class*=Content]",
    "[class*=commentContent]",
    "[class*=reviewText]",
    "[class*=rateContent]",
    "[class*=desc]",
    "[class*=Desc]",
    "[data-testid*=content]",
    "blockquote",
    "p",
  ]);
  const longestDirect = window.pickLongestText(directCandidates, 6, 500);
  if (longestDirect) {
    return longestDirect;
  }

  const fallbackText = window
    .getVisibleText(node)
    .split(/\n+/)
    .map((item) => window.normalizeText(item))
    .filter((item) => item.length >= 6)
    .filter((item) => !["查看全部评价", "查看全部回答", "收起"].includes(item));
  return window.pickLongestText(fallbackText, 6, 500);
};
window.extractQaQuestion = (node) => {
  const explicit = window.pickLongestText(
    window.collectTexts(node, [
      "[class*=questionTitle]",
      "[class*=question]",
      "[class*=Question]",
      "[class*=askTitle]",
      "[class*=ask]",
      "[data-testid*=question]",
    ]),
    4,
    300
  );
  if (explicit) {
    return explicit.replace(/^(问\s*[:：]?)/, "").trim();
  }

  const lines = window
    .getVisibleText(node)
    .split(/\n+/)
    .map((item) => window.normalizeText(item))
    .filter(Boolean);
  const matched = lines.find((line) => /^问\s*[:：]?/.test(line)) ?? lines[0] ?? "";
  return matched.replace(/^(问\s*[:：]?)/, "").trim();
};
window.extractQaAnswer = (node, question) => {
  const explicit = window
    .collectTexts(node, [
      "[class*=answerContent]",
      "[class*=answer]",
      "[class*=Answer]",
      "[class*=replyContent]",
      "[class*=reply]",
      "[class*=Reply]",
      "[data-testid*=answer]",
    ])
    .map((item) => item.replace(/^(答\s*[:：]?)/, "").trim())
    .filter((item) => item && item !== question);
  const explicitJoined = window.uniqueJoin(explicit, " || ", 3);
  if (explicitJoined) {
    return explicitJoined;
  }

  const lines = window
    .getVisibleText(node)
    .split(/\n+/)
    .map((item) => window.normalizeText(item))
    .filter(Boolean)
    .map((item) => item.replace(/^(答\s*[:：]?)/, "").trim())
    .filter((item) => item && item !== question);
  return window.uniqueJoin(lines, " || ", 3);
};
window.buildRuntimeDiagnostics = ({
  reviewNodes = [],
  qaNodes = [],
  reviews = [],
  qaPairs = [],
  reviewDrawerOpened = false,
  qaDrawerOpened = false,
}) => {
  const bridge = window.getRuntimeBridge();
  const events = Array.isArray(bridge.events) ? bridge.events.slice(-20) : [];
  const diagnostics = bridge.diagnostics ?? {};
  const issues = [];

  if (!reviewDrawerOpened) {
    issues.push("未确认打开评价抽屉，可能是评价入口文案或点击节点变更。");
  }
  if (reviewNodes.length === 0) {
    issues.push("未匹配到评论节点，可能是评论列表容器或 item selector 已失效。");
  }
  if (reviewNodes.length > 0 && reviews.length === 0) {
    issues.push("匹配到评论节点但未提取到正文，可能是评论正文 selector 已失效。");
  }
  if (!qaDrawerOpened) {
    issues.push("未确认打开问答抽屉，可能是问答入口文案或点击节点变更。");
  }
  if (qaNodes.length === 0) {
    issues.push("未匹配到问答节点，可能是问答列表容器或 item selector 已失效。");
  }
  if (qaNodes.length > 0 && qaPairs.length === 0) {
    issues.push("匹配到问答节点但未提取到问题/回答，可能是问答内容 selector 已失效。");
  }

  return {
    status: issues.length ? "degraded" : "ok",
    issues,
    stages: diagnostics,
    counters: {
      eventCount: events.length,
      reviewNodeCount: reviewNodes.length,
      reviewSampleCount: reviews.length,
      qaNodeCount: qaNodes.length,
      qaSampleCount: qaPairs.length,
    },
    recentEvents: events.map((item) => ({
      type: window.normalizeText(item?.type),
      detail: window.normalizeText(item?.detail),
      timestamp: Number(item?.timestamp) || 0,
    })),
    lastMatchedSelector: window.normalizeText(bridge.lastMatchedSelector),
    lastEvent: window.normalizeText(bridge.lastEvent),
    lastDetail: window.normalizeText(bridge.lastDetail),
  };
};
window.collectReviews = async () => {
  const drawer = await window.openOverlayByKeywords(window.REVIEW_TRIGGER_KEYWORDS);
  window.updateDiagnosticStage("reviews", {
    triggerKeywords: window.REVIEW_TRIGGER_KEYWORDS,
    drawerOpened: Boolean(drawer),
    containerSelectors: window.REVIEW_CONTAINER_SELECTORS,
    itemSelectors: window.REVIEW_ITEM_SELECTORS,
  });
  await window.waitForSelectors(drawer ?? document, window.REVIEW_CONTAINER_SELECTORS, 6000);
  await window.smartScrollIfNeeded(drawer ?? document.documentElement, drawer ? 6 : 5, 900);
  await window.waitForSelectors(drawer ?? document, window.REVIEW_CONTAINER_SELECTORS, 3000);

  const reviewNodes = Array.from(
    (drawer ?? document).querySelectorAll(window.asSelectorText(window.REVIEW_ITEM_SELECTORS))
  );

  const items = [];
  const seen = new Set();
  for (const node of reviewNodes) {
    const text = window.extractReviewText(node);
    const rating = window.pickText(node, ["[class*=star]", "[class*=rate]", "[class*=score]"]);
    const tag = window.pickTexts(node, [
      "[class*=tag]",
      "[class*=sku]",
      "[class*=append]",
    ]).join(" | ");
    const normalized = window.normalizeText(text);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push({
      text: normalized,
      rating,
      tag,
      isNegative: ["差", "一般", "失望", "问题", "退货", "退款", "破损", "慢"].some((keyword) =>
        normalized.includes(keyword)
      ),
    });
    if (items.length >= TASK.reviewLimit) {
      break;
    }
  }
  window.updateDiagnosticStage("reviews", {
    drawerOpened: Boolean(drawer),
    nodeCount: reviewNodes.length,
    sampleCount: items.length,
    samplePreview: items.slice(0, 3).map((item) => item.text),
  });
  return {
    drawerOpened: Boolean(drawer),
    nodes: reviewNodes,
    items,
  };
};
window.collectQaPairs = async () => {
  const drawer = await window.openOverlayByKeywords(window.QA_TRIGGER_KEYWORDS);
  const qaRoot =
    (await window.waitForSelectors(drawer ?? document, window.QA_CONTAINER_SELECTORS, 6000)) ||
    drawer ||
    document;
  window.updateDiagnosticStage("qa", {
    triggerKeywords: window.QA_TRIGGER_KEYWORDS,
    drawerOpened: Boolean(drawer),
    containerSelectors: window.QA_CONTAINER_SELECTORS,
    itemSelectors: window.QA_ITEM_SELECTORS,
  });
  await window.scrollContainer(qaRoot, 4, 800);
  await window.clickAllByKeywords(qaRoot, ["查看全部回答"]);
  await window.scrollContainer(qaRoot, 4, 900);
  await window.waitForSelectors(qaRoot, window.QA_ITEM_SELECTORS, 3000);

  const qaNodes = Array.from(qaRoot.querySelectorAll(window.asSelectorText(window.QA_ITEM_SELECTORS)));

  const items = [];
  const seen = new Set();
  for (const node of qaNodes) {
    const question = window.extractQaQuestion(node);
    const answer = window.extractQaAnswer(node, question);
    const key = window.normalizeText(`${question}|${answer}`);
    if (!question || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({ question, answer });
    if (items.length >= TASK.qaLimit) {
      break;
    }
  }
  window.updateDiagnosticStage("qa", {
    drawerOpened: Boolean(drawer),
    nodeCount: qaNodes.length,
    sampleCount: items.length,
    samplePreview: items.slice(0, 3).map((item) => item.question),
  });
  return {
    drawerOpened: Boolean(drawer),
    nodes: qaNodes,
    items,
  };
};
window.runTaobaoReviewCollection = async () => {
  if (!window.TASK) {
    throw new Error("TASK 未初始化，请先加载 taobao-script.js");
  }

  const bridge = window.getRuntimeBridge();
  bridge.events = [];
  bridge.diagnostics = {};

  await window.waitForDocumentReady();
  await window.wait(1200);

  const reviewResult = await window.collectReviews();
  const qaResult = await window.collectQaPairs();
  const runtimeDiagnostics = window.buildRuntimeDiagnostics({
    reviewNodes: reviewResult.nodes,
    qaNodes: qaResult.nodes,
    reviews: reviewResult.items,
    qaPairs: qaResult.items,
    reviewDrawerOpened: reviewResult.drawerOpened,
    qaDrawerOpened: qaResult.drawerOpened,
  });

  window.__TAOBAO_REVIEW_RESULT__ = {
    platform: "taobao",
    productUrl: window.location.href,
    reviews: reviewResult.items,
    qaPairs: qaResult.items,
    runtimeDiagnostics,
  };
  return window.__TAOBAO_REVIEW_RESULT__;
};
