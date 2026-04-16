window.TASK = { targetCount: 20, filterAds: true, allData: [] };
window._getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
window._fmtPct = s => { const m = s?.match(/(\d+(\.\d+)?)/); return m ? parseFloat(m[1]) / 100 : 0; };
window._fmtQty = s => { if (!s) return 0; let n = parseFloat(s.replace(/[\u5df2\u552e+\u4ef6,]/g, '').trim()); if (s.includes('\u4e07')) n *= 10000; return isNaN(n) ? 0 : n; };
window._getStar = el => { let s = 0; el?.querySelectorAll('.service-rate img').forEach(img => { const b = img.style.background || ''; if (b.includes('0%')) s += 1; else if (b.includes('50%')) s += 0.5; }); return s || null; };

window.parseItemData = (item, idx) => {
    const rpt = {};
    (item.getAttribute('data-aplus-report') || '').replace(/^.*?@/, '').split('^').forEach(p => { const [k, v] = p.split('@'); if (k) rpt[k] = decodeURIComponent(v || ''); });
    const isAd = rpt._p_isad === '1';
    if (TASK.filterAds && isAd) return null;
    const itemId = rpt.offerId || rpt.object_id || item.getAttribute('data-renderkey')?.split('_').pop() || item.getAttribute('data-key-value')?.replace('offer_', '');
    if (!itemId) return null;
    const icon = item.querySelector('.offer-shop-row .desc-icon')?.src || '';
    const stats = {};
    item.querySelectorAll('.stat-item').forEach(el => { const l = el.querySelector('.stat-label')?.innerText.trim(); const v = el.querySelector('.stat-value')?.innerText.trim(); if (l) stats[l] = v; });
    const imgEl = item.querySelector('.main-img');
    const img = imgEl ? (imgEl.src || imgEl.getAttribute('data-lazy-src') || imgEl.getAttribute('data-src') || '') : '';
    let link = item.href || item.querySelector('a')?.href || '';
    if (link.startsWith('//')) link = 'https:' + link;
    return {
        itemId, categoryId: rpt.leafCategory || rpt.postCategoryId || 'unknown', sellerMemberId: rpt.object_member_id || 'unknown',
        title: item.querySelector('.title-text')?.innerText.trim() || '',
        price: parseFloat(item.querySelector('.text-main')?.innerText + (item.querySelector('.price-item div:last-child')?.innerText || '')) || 0,
        salesQuantity: _fmtQty(item.querySelector('.col-desc_after')?.innerText),
        returnRate: _fmtPct(item.innerText.match(/\u56de\u5934\u7387\s*(\d+%)/)?.[1]),
        shopName: item.querySelector('.offer-shop-row .desc-text')?.innerText.trim() || '',
        isShili: icon.includes('shili') || icon.includes('O1CN01IY0R5U') ? 1 : 0,
        isSuperFactory: icon.includes('O1CN01bA1kzJ') || item.innerText.includes('\u8d85\u7ea7\u5de5\u5382') ? 1 : 0,
        isBiaoWang: item.querySelector('img[title="\u6807\u738b"]') ? 1 : 0,
        isAd: isAd ? 1 : 0,
        serviceStarRating: _getStar(item),
        purchaseConsultScore: parseFloat(stats['\u91c7\u8d2d\u54a8\u8be2']) || 0,
        returnExperienceScore: parseFloat(stats['\u9000\u6362\u4f53\u9a8c']) || 0,
        qualityExperienceScore: parseFloat(stats['\u54c1\u8d28\u4f53\u9a8c']) || 0,
        disputeResolutionScore: parseFloat(stats['\u7ea0\u7eb7\u89e3\u51b3']) || 0,
        logisticsTimeScore: parseFloat(stats['\u7269\u6d41\u65f6\u6548']) || 0,
        priceAdvantages: Array.from(item.querySelectorAll('.offer-desc-row .desc-text')).map(e => e.innerText.trim()).filter(t => t && t !== '\uff5c'),
        marketingTags: Array.from(item.querySelectorAll('.offer-tag-row .desc-text')).map(e => e.innerText.trim()).filter(t => t),
        searchRank: parseInt(rpt.position) || idx + 1,
        algoModelId: rpt.algo_model_id || 'unknown',
        mainImage: img,
        detailLink: link
    };
};