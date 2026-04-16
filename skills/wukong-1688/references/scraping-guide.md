# 1688 抓取执行手册（低自由度）

本文件只定义执行顺序与门禁，不提供可复制的大段内联 JS。  
抓取逻辑必须通过 `scripts/` 下的分段脚本执行。

---

## 1. GBK 编码（必须）

1688 搜索参数 `keywords` 必须是 GBK percent-encoding。  
浏览器原生 JS 不稳定支持 GBK 编码，禁止在页面内临时实现编码算法。

固定做法：使用仓库内稳定函数 `ali.urls.encode_gbk` 生成关键词编码，再拼接 URL。

```python
from ali.urls import encode_gbk
keyword_gbk = encode_gbk(keyword)
```

URL 模板：

```text
https://s.1688.com/selloffer/offer_search.htm?keywords=<GBK编码>&sortType=<sortType>&descendOrder=<true|false>
```

可选参数：`priceStart`、`priceEnd`。

---

## 2. 分段脚本（必须顺序执行）

1. `scripts/scraping-core.js`：字段解析函数和任务对象
2. 参数注入（仅短脚本）：
   `window.TASK.targetCount=<N>; window.TASK.filterAds=<true|false>;`
3. `scripts/scraping-scroll.js`：按需滚动工具函数
4. `scripts/scraping-controller.js`：流程控制（采集、翻页、停止）
5. 读取结果：
   `JSON.stringify(window.allData)` 和 `JSON.stringify(window.__SCRAPE_STATUS__)`

示例：

```javascript
const injectScrapingCore = () => { /* 来自 scripts/scraping-core.js */ };
const injectScrapingScroll = () => { /* 来自 scripts/scraping-scroll.js */ };
const runScrapingController = async () => { /* 来自 scripts/scraping-controller.js */ };
```

```python
use_browser(action="navigate", url=search_url)
use_browser(action="evaluate", fn=injectScrapingCore.toString())
use_browser(action="evaluate", script="window.TASK.targetCount=20; window.TASK.filterAds=true;")
use_browser(action="evaluate", fn=injectScrapingScroll.toString())
use_browser(action="evaluate", fn=runScrapingController.toString())
raw_data = use_browser(action="evaluate", script="JSON.stringify(window.allData)")
raw_status = use_browser(action="evaluate", script="JSON.stringify(window.__SCRAPE_STATUS__)")
```

---

## 3. 采集门禁（不通过即终止）

1. `allData.length > 0`
2. 每条记录必须包含：
   `itemId`、`title`、`detailLink`、`mainImage`、`price`、`salesQuantity`、`shopName`、`searchRank`
3. `detailLink`、`mainImage` 必须是 `http/https`
4. 读取并检查 `__SCRAPE_STATUS__`，要求：
   - `__SCRAPE_STATUS__.target == targetCount`
   - `__SCRAPE_STATUS__.collected == allData.length`
5. 数量阈值：`allData.length >= min(targetCount, 10)`  
   低于阈值直接失败终止

---

## 4. 脚本职责边界

- `core`：只做字段解析
- `scroll`：只做按需滚动
- `controller`：只做流程控制与翻页交互

禁止将上述职责混在单个内联脚本中。
