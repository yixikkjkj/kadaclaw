window.smartScrollIfNeeded = async () => {
    const sel = '.search-offer-wrapper, .ocms-fusion-1688-pc-pc-ad-common-offer-2024';
    const need = () => {
        const valid = Array.from(document.querySelectorAll(sel)).filter(i => !(TASK.filterAds && i.getAttribute('data-aplus-report')?.includes('_p_isad@1'))).length;
        return (valid + TASK.allData.length) < TASK.targetCount;
    };
    if (!need()) return;
    await new Promise(r => {
        window.scrollBy({ top: _getRandom(1000, 1500), behavior: 'smooth' });
        const act = () => {
            window.scrollBy({ top: Math.random() > 0.7 ? _getRandom(700, 1000) : _getRandom(300, 500), behavior: 'smooth' });
            if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 200 || !need()) setTimeout(r, 1000);
            else setTimeout(act, _getRandom(800, 1500));
        };
        setTimeout(act, 1000);
    });
};
