(async () => {
    const sel = ".search-offer-wrapper, .ocms-fusion-1688-pc-pc-ad-common-offer-2024";
    if (!window.TASK) throw new Error("TASK 未初始化，请先加载 scripts/scraping-core.js");
    if (typeof window.parseItemData !== "function") throw new Error("parseItemData 未初始化，请先加载 scripts/scraping-core.js");
    if (typeof window.smartScrollIfNeeded !== "function") throw new Error("smartScrollIfNeeded 未初始化，请先加载 scripts/scraping-scroll.js");

    console.log(`[controller] start target=${TASK.targetCount} filterAds=${TASK.filterAds}`);
    TASK.allData = Array.isArray(TASK.allData) ? TASK.allData : [];

    while (TASK.allData.length < TASK.targetCount) {
        const ids = new Set(TASK.allData.map((item) => item.itemId));
        document.querySelectorAll(sel).forEach((item, idx) => {
            try {
                const parsed = parseItemData(item, idx);
                if (parsed && !ids.has(parsed.itemId) && TASK.allData.length < TASK.targetCount) {
                    TASK.allData.push(parsed);
                    ids.add(parsed.itemId);
                }
            } catch (error) {
                console.warn("[controller] parse skip", error);
            }
        });

        if (TASK.allData.length >= TASK.targetCount) break;
        await smartScrollIfNeeded();

        if (TASK.allData.length >= TASK.targetCount) break;
        const nextBtn = document.querySelector(".fui-paging-list .fui-next");
        if (!nextBtn || nextBtn.classList.contains("fui-next-disabled")) break;

        await new Promise((resolve) => setTimeout(resolve, _getRandom(1800, 3200)));
        nextBtn.click();
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, _getRandom(3500, 5500)));
    }

    window.allData = TASK.allData;
    window.__SCRAPE_STATUS__ = {
        collected: TASK.allData.length,
        target: TASK.targetCount,
        reachedTarget: TASK.allData.length >= TASK.targetCount
    };
    console.log(`[controller] done collected=${window.__SCRAPE_STATUS__.collected}`);
})();
