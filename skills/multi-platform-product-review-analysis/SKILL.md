---
name: multi-platform-product-review-analysis
description: Use this skill when the user wants to input a Douyin, Pinduoduo, Taobao, Tmall, or JD product link, open the product page in the default runtime-provided CDP browser, collect the product's visible information plus page reviews and Q&A, summarize only the current product's review and Q&A signals, and export the result to a local Excel file.
metadata: {"openclaw":{"requires":{"config":["browser.enabled"]}}}
---

# 多平台商品评论分析

目标：稳定、可复用地用默认 CDP 浏览器打开单个商品页，采集评论与问答，并导出本地 Excel。

## 硬约束

1. 按固定流程执行，禁止跳步
2. 浏览器操作必须严格按 bundle 返回的 `browserSteps` 顺序执行
3. 页面交互仅使用技能内脚本，禁止临时拼接大段内联抓取 JS
4. 所有浏览器 `evaluate` 都只用 `fn` 参数，禁止直接传 `script`
5. 如果浏览器工具返回 `No pages available in the connected browser`，必须先执行 `navigate`
6. 仅采集当前商品页可见的评论、问答和诊断信息，不补抓商品基础字段
7. 若登录、验证码、滑块拦截采集，立即暂停并让用户在同一浏览器会话内完成

## 工作流

1. 执行 `node skills/multi-platform-product-review-analysis/scripts/build_product_review_bundle.mjs <product-url>`
2. 执行前 **必须先阅读** `references/browser-collection.md`
3. 读取返回 JSON，确认：
   - `platform`
   - `normalizedUrl`
   - `openUrl`
   - `browserSteps`
   - `domExtractorImplemented`
   - `suggestedOutputPath`
4. 按 `browserSteps` 顺序执行浏览器操作
5. 解析最后一步返回的 JSON 字符串，组装为 `target`
6. 生成 payload：
   - `context.platform`
   - `context.sourceUrl`
   - `context.normalizedUrl`
   - `context.collectedAt`
   - `target`
7. 执行 `node skills/multi-platform-product-review-analysis/scripts/build_review_report.mjs <input-json|-> <output-xlsx> [output-json]`
8. 输出简短总结

> 严格顺序执行，任一门禁失败立即终止。

## 输出规范

1. 结果中必须包含本地 Excel 路径
2. 必须包含平台、评论样本数、问答样本数
3. 若评论或问答为空，必须说明并引用 `runtimeDiagnostics` 的主要问题
4. 最终回复只给结果摘要，不展开脚本细节、命令参数或选择器实现

输出示例：

```text
已完成商品评论分析并导出本地报告。
- 平台：taobao
- 评论样本数：18
- 问答样本数：7
- Excel 路径：/Users/zfp/Downloads/taobao-product-review-analysis-20260415-120000.xlsx
```
