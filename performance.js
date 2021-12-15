console.log('performance.timing.fetchStart', performance.timing.fetchStart)
function calculateScore(el, tiers, parentScore) {
    let score = 0;
    const tagName = el.tagName;
    if ("SCRIPT" !== tagName && "STYLE" !== tagName && "META" !== tagName && "HEAD" !== tagName) {
        const childrenLen = el.children ? el.children.length : 0;
        if (childrenLen > 0)
            for (let childs = el.children, len = childrenLen - 1; len >= 0; len--) {
                score += calculateScore(childs[len], tiers + 1, score > 0);
            }
        if (score <= 0 && !parentScore) {
            if (!(el.getBoundingClientRect && el.getBoundingClientRect().top < window.innerHeight)) return 0;
        }
        // 每增加一层 得 0.5 分，
        // 越在 内层的 DOM 越 接近于用户看到的
        score += 1 + .5 * tiers;
    }
    return score;
}

const SCORE_ITEMS = [];

let calcT = 0;

const CHECK_INTERVAL = 500

const obs = {
    imgs: [],
    supportTiming() {
        return !!performance.timing;
    },
    initObserver() {
        try {
            if (this.supportTiming()) {
                this.observer = new MutationObserver(() => {
                    console.time('observer')
                    const start = Date.now();
                    let time = Date.now() - performance.timing.fetchStart;
                    let bodyTarget = document.body;
                    if (bodyTarget) {
                        let score = 0;
                        score += calculateScore(bodyTarget, 1, false);
                        SCORE_ITEMS.push({
                            score,
                            t: time
                        });
                    } else {
                        SCORE_ITEMS.push({
                            score: 0,
                            t: time
                        });
                    }
                    calcT += Date.now() - start;
                    console.timeEnd('observer')
                });
            }

            this.observer.observe(document, {
                childList: true,  // 观察子节点
                subtree: true,    // 观察后代节点
            });

            if (document.readyState === "complete") {
                this.calFinallScore();
            } else {
                window.addEventListener(
                    "load",
                    () => {
                        this.calFinallScore();
                    },
                    true
                );
                window.addEventListener(
                    'beforeunload',
                    () => {
                        this.calFinallScore();
                    },
                    true
                );
            }
        } catch (error) {}
    },
    _getImgSrcFromBgImg: function (bgImg) {
        var imgSrc;
        var matches = bgImg.match(/url\(.*?\)/g);
        if (matches && matches.length) {
            var urlStr = matches[matches.length - 1];
            var innerUrl = urlStr.replace(/^url\([\'\"]?/, '').replace(/[\'\"]?\)$/, '');
            if (((/^http/.test(innerUrl) || /^\/\//.test(innerUrl)))) {
                imgSrc = innerUrl;
            }
        }
        return imgSrc;
    },
    getImgSrcFromDom: function (dom) {
        if (!(dom.getBoundingClientRect && dom.getBoundingClientRect().top < window
                .innerHeight))
            return false;
        const imgFilter = [/(\.)(png|jpg|jpeg|gif|webp|ico|bmp|tiff|svg)/i]
        var src;
        if (dom.nodeName.toUpperCase() === 'IMG') {
            src = dom.getAttribute('src');
        } else {
            var computedStyle = window.getComputedStyle(dom);
            var bgImg = computedStyle.getPropertyValue('background-image') || computedStyle
                .getPropertyValue('background');
            var tempSrc = this._getImgSrcFromBgImg(bgImg, imgFilter);
            if (tempSrc && this._isImg(tempSrc, imgFilter)) {
                src = tempSrc;
            }
        }
        return src;
    },
    _isImg: function (src, imgFilter) {
        for (var i = 0, len = imgFilter.length; i < len; i++) {
            if (imgFilter[i].test(src)) {
                return true;
            }
        }
        return false;
    },
    checkImgs(e) {
        var _this = this,
            tName = e.tagName;
        if ("SCRIPT" !== tName && "STYLE" !== tName && "META" !== tName && "HEAD" !== tName) {
            var el = this.getImgSrcFromDom(e)
            if (el && !this.imgs.includes(el))
                this.imgs.push(el)
            var len = e.children ? e.children.length : 0;
            if (len > 0)
                for (var child = e.children, _len = len - 1; _len >= 0; _len--)
                    _this.checkImgs(child[_len]);
        }
    },
    calFinallScore() {
        try {
            const time = Date.now() - performance.timing.fetchStart;
            console.log(
                time > 10000,
                SCORE_ITEMS && SCORE_ITEMS.length > 4 &&
                time - (SCORE_ITEMS && SCORE_ITEMS.length && SCORE_ITEMS[SCORE_ITEMS.length - 1].t || 0) > 2 * CHECK_INTERVAL,
                (SCORE_ITEMS.length > 10 && window.performance.timing.loadEventEnd !== 0 && SCORE_ITEMS[SCORE_ITEMS.length - 1].score === SCORE_ITEMS[SCORE_ITEMS.length - 9].score)
            )
            // 计算时间超过 10s 还没有结束
            var isCheckFmp = time > 10000 ||
            // 计算了 4 轮 且 1s 内 没有再计算
                SCORE_ITEMS && SCORE_ITEMS.length > 4 &&
                time - (SCORE_ITEMS && SCORE_ITEMS.length && SCORE_ITEMS[SCORE_ITEMS.length - 1].t || 0) > 2 * CHECK_INTERVAL ||
                // 计算了 9次，且 分数不再变化
                (SCORE_ITEMS.length > 10 && window.performance.timing.loadEventEnd !== 0 && SCORE_ITEMS[SCORE_ITEMS.length - 1].score === SCORE_ITEMS[SCORE_ITEMS.length - 9].score);
            if (this.observer && isCheckFmp) {
                this.observer.disconnect();
                console.log('SCORE_ITEMS', SCORE_ITEMS);
                // 计算元素的 分数变化率，获取变化率最大点对应的分数
                // 然后找到该分数对应的时间
                let fmps = [...SCORE_ITEMS];
                let record = null;
                for (let o = 1; o < fmps.length; o++) {
                    if (fmps[o].t >= fmps[o - 1].t) {
                        let l = fmps[o].score - fmps[o - 1].score;
                        (!record || record.rate <= l) && (record = {
                            t: fmps[o].t,
                            rate: l
                        });
                    }
                }
                try {
                    const start = Date.now();
                    console.time('checkImg');
                    this.checkImgs(document.body);
                    console.timeEnd('checkImg');
                    calcT += Date.now() - start;
                    let max = Math.max(...this.imgs.map(element => {
                        if (/^(\/\/)/.test(element)) element = 'https:' + element;
                        try {
                            console.log(element, performance.getEntriesByName(element)[0])
                            return performance.getEntriesByName(element)[0].responseEnd || 0
                        } catch (error) {
                            return 0
                        }
                    }))
                    record && record.t > 0 ? this.setPerformance({
                        fmp: record.t,
                        img: max
                    }) : this.setPerformance({});
                } catch (error) {
                    this.setPerformance({});
                    // console.error(error)
                }
            } else {
                setTimeout(() => {
                    this.calFinallScore();
                }, CHECK_INTERVAL);
            }
        } catch (error) {

        }
    },
    setPerformance(result) {
        console.table(result);
        console.log('calc-time', calcT)
    }
}
obs.initObserver();