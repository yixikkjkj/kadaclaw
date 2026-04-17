# 商品评论采集执行手册（低自由度）

本文件只定义浏览器执行顺序与门禁。  
抓取逻辑必须通过 `scripts/lib/extractors/` 产出的分段脚本执行。

---

## 1. 固定执行顺序

先运行：

```bash
node skills/multi-platform-product-review-analysis/scripts/build_product_review_bundle.mjs <product-url>
```

然后只读取返回 JSON 里的这些字段：

- `platform`
- `normalizedUrl`
- `openUrl`
- `browserSteps`
- `domExtractorImplemented`
- `suggestedOutputPath`

---

## 2. 浏览器步骤（必须顺序执行）

`browserSteps` 是唯一可信的浏览器执行计划。  
必须按数组顺序逐步执行，不得跳步，不得把多个步骤手动合并成一个自写脚本。

淘宝当前不是固定 4 步，而是“短步骤分片注入”：

1. `navigate` 到 `openUrl`
2. `evaluate fn=<init buffer>` 初始化页面内脚本缓存
3. 多次 `evaluate fn=<append chunk>` 依次写入脚本分片
4. `evaluate fn=<load extractor>` 把缓存脚本加载到页面上下文
5. `evaluate fn=<run function>` 启动采集
6. `evaluate fn=<result reader function>` 读取结果

实际执行时必须以 `browserSteps` 数组为准，不要手写步数。

约束：

- 浏览器工具若要求 `act.kind`，则 `browserSteps` 中的 `kind` 必须原样透传
- 所有 `evaluate` 都只用 `fn`
- `fn` 必须是完整函数体字符串，例如 `() => { ... }` 或 `async () => { ... }`
- 禁止把 `window.runTaobaoReviewCollection()` 这种表达式直接传给 `fn`
- 如果浏览器工具报 `No pages available in the connected browser`，先重跑第 1 步

---

## 3. 结果门禁（不通过即终止）

最后一步必须返回可解析 JSON 字符串。解析后要求：

1. `target.platform` 非空
2. `target.productUrl` 非空
3. `target.reviews` 是数组
4. `target.qaPairs` 是数组
5. `target.runtimeDiagnostics` 是对象

如果评论或问答为空，不是立即失败；但必须检查 `runtimeDiagnostics.status`、`issues`、`stages`，并在最终输出中说明。

---

## 4. 职责边界

- `build_product_review_bundle.mjs`：解析链接并生成执行计划
- `scripts/lib/extractors/*.mjs`：拼装浏览器分步脚本
- `taobao-script.js`：页面内采集逻辑
- `build_review_report.mjs`：写 Excel 和标准化 JSON

禁止把这些职责混在一个临时脚本里重写。
