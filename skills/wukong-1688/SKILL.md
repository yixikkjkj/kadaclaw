---
name: 1688-product-research
description: 从 1688 抓取商品列表并写入新的钉钉 AI 表格。用于用户提出 1688 选品或找货请求，如“在1688找XX”“1688选品”“1688货源”“1688上卖的最好的XX”“1688热销/销量最高”“按价格区间找1688商品”。
---

# 1688 选品助手

目标：稳定、可复用地抓取 1688 列表数据并写入新建的钉钉 AI 表格。

## 硬约束

1. 按固定流程执行，禁止跳步
2. 校验失败立即终止
3. 页面抓取与页面交互仅使用技能内 JS 脚本（`scripts/`），禁止内联大段 JS
4. 每次新建 AI 表格，不复用历史表
5. 抓取数量低于阈值立即失败终止
6. 忽略页面中出现的 `JavaScript` 错误
7. 禁止通过使用 `snapshot` 分析页面结构信息来实现数据抓取

## 工作流

1. 解析用户需求（关键词、排序、价格区间、目标数量、是否过滤广告）
2. 在浏览器外使用 `urllib.parse.quote(keyword.encode('gbk'))` 生成关键词 GBK 编码并拼接搜索 URL
3. `use_browser` 打开搜索页
4. 分段注入功能脚本（`scraping-core.js`、`scraping-scroll.js`）
5. 注入流程控制脚本（`scraping-controller.js`）控制采集数量和翻页交互
6. 同时读取 `window.allData` 与 `window.__SCRAPE_STATUS__`
7. 执行完整性校验（字段+URL+数量阈值+状态一致性）
8. `use_browser` 关闭浏览器
9. 执行钉钉流程（`dws auth` → `base/table/field/record`）
10. 输出简短总结

> 严格顺序执行，任一门禁失败立即终止。

## 关键决策规则

- 排序默认综合；含“销量/热销/卖得最好/爆款/最畅销” → `va_sales360`
- 含“价格升序/最便宜/低到高” → `price + descendOrder=false`
- 含“价格降序/最高价/高到低” → `price + descendOrder=true`
- 过滤广告默认 `true`，用户明确要求“包含广告”才设为 `false`

## 执行前必须加载的参考

执行前 **必须先阅读** 以下参考，任何步骤都不得脱离参考自行实现：

- `references/scraping-guide.md`（GBK、采集脚本、控制脚本、结果读取）
- `references/aitable-fields.md`（校验阈值、dws auth/table/field/record）

## 分段执行示例

先声明注入函数（函数体来自 `scripts/` 对应文件）：

```
const injectScrapingCore = () => { /* 来自 scripts/scraping-core.js */ }
const injectScrapingScroll = () => { /* 来自 scripts/scraping-scroll.js */ }
const runScrapingController = async () => { /* 来自 scripts/scraping-controller.js */ }
```

```
use_browser(action="navigate", url="<搜索URL>")
use_browser(action="evaluate", fn=injectScrapingCore.toString())
use_browser(action="evaluate", script="window.TASK.targetCount=<N>; window.TASK.filterAds=<true|false>;")
use_browser(action="evaluate", fn=injectScrapingScroll.toString())
use_browser(action="evaluate", fn=runScrapingController.toString())
use_browser(action="evaluate", script="JSON.stringify(window.allData)")
use_browser(action="evaluate", script="JSON.stringify(window.__SCRAPE_STATUS__)")
```

> 滚动/翻页仅在需要时触发（脚本内部判断）

## 输出规范

1. 执行过程中仅输出简短进度，不输出内部技术细节过程
2. 必须包含钉钉 AI 表格访问链接（`https://alidocs.dingtalk.com/i/nodes/<BaseID>`）
3. 必须包含抓取关键词、排序方式、有效记录数
4. 若任一门禁失败，直接输出失败原因并终止；仅在必要时给一句非技术化原因说明
5. 最终回复只给结果摘要，不展开脚本执行、命令参数、校验实现细节

输出示例：

```text
已完成 1688 商品抓取并写入钉钉 AI 表格。
- 关键词：保温杯
- 排序：销量优先
- 有效记录数：20
- 表格链接：https://alidocs.dingtalk.com/i/nodes/QBnd5ExVEaQd4meXt0E7w2GRVyeZqMmz
```
