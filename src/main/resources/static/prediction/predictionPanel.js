(function () {
    'use strict';

    var C = {
        x: 60, y: 60, w: 480,
        maxOutcomes: 10,
        resultRevealMs: 2800,
        lingerMs: 7000,
        appearMs: 1100,
        disappearMs: 700,
        barEasing: 0.08,
    };

    var IMG_W = 1024, IMG_H = 1536;

    var S = { HIDDEN: 0, APPEARING: 1, ACTIVE: 2, LOCKED: 3, RESOLVED: 4, DISAPPEARING: 5 };
    var state = S.HIDDEN, ts = 0;
    var data = null;
    var animPcts = [], prevPts = [];
    var winnerIdx = -1, winAmt = 0;

    var panel, scanReveal, titleEl, timerEl, slotUpper, slotLower, lockedOv, lockedScan;
    var outEls = [];
    var timerIv = null, closeTimer = null;

    function buildDOM() {
        var root = document.getElementById('predictionPanelRoot');
        if (!root) return false;

        var el = document.createElement('div');
        el.className = 'pr-panel';
        el.innerHTML = (
            '<div class="pr-scan-reveal"></div>' +
            '<div class="pr-header-area">' +
                '<div class="pr-title"></div>' +
                '<div class="pr-timer"></div>' +
            '</div>' +
            '<div class="pr-slot pr-slot-upper"></div>' +
            '<div class="pr-slot pr-slot-lower"></div>' +
            '<div class="pr-locked-ov"></div>' +
            '<div class="pr-locked-scan"></div>' +
            '<div class="pr-result-ov"><div class="pr-result-txt"></div></div>' +
            '<div class="pr-frame"></div>' +
            '<div class="pr-lock-surge"></div>' +
            '<svg class="pr-svg-defs" width="0" height="0" style="position:absolute;pointer-events:none;">' +
                '<defs>' +
                    '<filter id="pr-red-only" color-interpolation-filters="sRGB">' +
                        '<feColorMatrix type="matrix" values="' +
                            '1.7 -1.9 -1.9 0 0  ' +
                            '0    0    0   0 0  ' +
                            '0    0    0   0 0  ' +
                            '0    0    0   1 0' +
                        '"/>' +
                        '<feComponentTransfer>' +
                            '<feFuncR type="linear" slope="1.4" intercept="-0.15"/>' +
                        '</feComponentTransfer>' +
                    '</filter>' +
                    '<filter id="pr-red-as-gold" color-interpolation-filters="sRGB">' +
                        '<feColorMatrix type="matrix" values="' +
                            '1.7 -1.9 -1.9 0 0  ' +
                            '0    0    0   0 0  ' +
                            '0    0    0   0 0  ' +
                            '0    0    0   1 0' +
                        '"/>' +
                        '<feComponentTransfer>' +
                            '<feFuncR type="linear" slope="1.4" intercept="-0.15"/>' +
                        '</feComponentTransfer>' +
                        '<feColorMatrix type="matrix" values="' +
                            '1    0 0 0 0  ' +
                            '0.84 0 0 0 0  ' +
                            '0.31 0 0 0 0  ' +
                            '0    0 0 1 0' +
                        '"/>' +
                    '</filter>' +
                '</defs>' +
            '</svg>' +
            '<div class="pr-frame-glow"></div>' +
            '<div class="pr-frame-glow-gold"></div>' +
            '<div class="pr-led pr-led-antenna"></div>'
        );
        root.appendChild(el);

        panel      = el;
        scanReveal = el.querySelector('.pr-scan-reveal');
        titleEl    = el.querySelector('.pr-title');
        timerEl    = el.querySelector('.pr-timer');
        slotUpper  = el.querySelector('.pr-slot-upper');
        slotLower  = el.querySelector('.pr-slot-lower');
        lockedOv   = el.querySelector('.pr-locked-ov');
        lockedScan = el.querySelector('.pr-locked-scan');
        return true;
    }

    function posPanel() {
        if (!panel) return;
        panel.style.left   = C.x + 'px';
        panel.style.top    = C.y + 'px';
        panel.style.width  = C.w + 'px';
        panel.style.height = Math.round(C.w * (IMG_H / IMG_W)) + 'px';
    }

    function buildOutcomes() {
        if (!slotUpper || !slotLower) return;
        slotUpper.innerHTML = '';
        slotLower.innerHTML = '';
        outEls = []; animPcts = []; prevPts = [];

        var outcomes = data ? (data.outcomes || []).slice(0, C.maxOutcomes) : [];
        var n = outcomes.length;

        if (n === 2) {
            slotUpper.classList.add('pr-slot--solo');
            slotLower.classList.add('pr-slot--solo');
            buildOneOutcome(outcomes[0], 0, slotUpper, 'pr-tw-blue', true);
            buildOneOutcome(outcomes[1], 1, slotLower, 'pr-tw-pink', true);
        } else if (n > 0) {
            slotUpper.classList.remove('pr-slot--solo');
            slotLower.classList.remove('pr-slot--solo');
            buildOneOutcome(outcomes[0], 0, slotUpper, 'pr-neutral', true);
            for (var i = 1; i < n; i++) {
                buildOneOutcome(outcomes[i], i, slotLower, 'pr-neutral', false);
            }
        }
    }

    function buildOneOutcome(o, idx, container, colorClass, solo) {
        var d = document.createElement('div');
        d.className = 'pr-outcome' + (solo ? ' pr-outcome--solo' : '') + ' ' + colorClass;
        d.innerHTML = (
            '<span class="pr-out-label"></span>' +
            '<span class="pr-out-pct">0%</span>' +
            '<div class="pr-out-track"><div class="pr-out-bar"></div></div>' +
            '<span class="pr-out-pts">0 pts · 0 predictors</span>'
        );
        d.querySelector('.pr-out-label').textContent = o.title || '';
        container.appendChild(d);
        outEls.push({
            root:    d,
            bar:     d.querySelector('.pr-out-bar'),
            label:   d.querySelector('.pr-out-label'),
            pts:     d.querySelector('.pr-out-pts'),
            pct:     d.querySelector('.pr-out-pct'),
            origIdx: idx,
        });
        animPcts.push(0);
        prevPts.push(o.channelPointsSpent || 0);
    }

    function formatPts(n) {
        if (n == null || isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    function updateBars() {
        if (!data || !outEls.length) return;
        var outcomes = (data.outcomes || []).slice(0, C.maxOutcomes);
        var totalPts = outcomes.reduce(function (s, o) { return s + (o.channelPointsSpent || 0); }, 0);

        var leadIdx = -1;
        if (state !== S.RESOLVED && totalPts > 0) {
            leadIdx = outcomes.reduce(function (b, o, i) {
                return (o.channelPointsSpent || 0) > (outcomes[b].channelPointsSpent || 0) ? i : b;
            }, 0);
        }

        outEls.forEach(function (el, k) {
            var i = el.origIdx;
            var o = outcomes[i];
            if (!o) return;
            var pts   = o.channelPointsSpent || 0;
            var users = o.numberOfUsers || 0;
            var target = totalPts > 0 ? pts / totalPts : 0;
            animPcts[k] = (animPcts[k] || 0) + (target - (animPcts[k] || 0)) * C.barEasing;
            el.bar.style.width = (animPcts[k] * 100).toFixed(2) + '%';
            el.pts.textContent = formatPts(pts) + ' pts · ' + users + ' predictor' + (users !== 1 ? 's' : '');
            if (el.pct) el.pct.textContent = (animPcts[k] * 100).toFixed(0) + '%';

            var isWin  = state === S.RESOLVED && i === winnerIdx;
            var isLost = state === S.RESOLVED && winnerIdx >= 0 && !isWin;
            var isLead = state !== S.RESOLVED && i === leadIdx && totalPts > 0;

            el.root.classList.toggle('pr-leading', isLead);
            el.root.classList.toggle('pr-winner',  isWin);
            el.root.classList.toggle('pr-loser',   isLost);
        });
    }

    function updateTimer() {
        if (!timerEl || !data) return;
        if (state === S.LOCKED) {
            timerEl.textContent = 'LOCKED';
            timerEl.className = 'pr-timer pr-locked';
            return;
        }
        if (state === S.RESOLVED) {
            timerEl.textContent = '';
            return;
        }
        if (!data.locksAt) {
            timerEl.textContent = '';
            return;
        }
        var rem = Math.max(0, Math.round((new Date(data.locksAt) - Date.now()) / 1000));
        var m = Math.floor(rem / 60), s = rem % 60;
        timerEl.textContent = ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
        timerEl.className = 'pr-timer' + (rem < 15 && rem > 0 ? ' pr-urgent' : '');
    }

    function loop(now) {
        requestAnimationFrame(loop);
        if (!panel || state === S.HIDDEN) return;
        var el = now - ts;

        if (state === S.APPEARING) {
            var prog = Math.min(1, el / C.appearMs);
            var eased = 1 - Math.pow(1 - prog, 3);
            var overshoot = prog > 0.85 ? Math.sin((prog - 0.85) / 0.15 * Math.PI) * 1.5 : 0;
            panel.style.transform = 'translateY(' + ((1 - eased) * -130 + overshoot).toFixed(2) + '%)';
            panel.style.opacity   = Math.min(1, prog * 3).toFixed(3);
            if (prog >= 1) go(S.ACTIVE);
        }

        if (state === S.DISAPPEARING) {
            var prog2  = Math.min(1, el / C.disappearMs);
            var eased2 = Math.pow(prog2, 2.8);
            panel.style.transform = 'translateY(' + (eased2 * -130).toFixed(2) + '%)';
            panel.style.opacity   = Math.max(0, 1 - prog2 * 1.3).toFixed(3);
            if (prog2 >= 1) go(S.HIDDEN);
        }

        if (state === S.RESOLVED) {
            winAmt = Math.min(1, el / C.resultRevealMs);
        }

        updateBars();
    }

    function go(s) {
        state = s; ts = performance.now();
        clearTimeout(closeTimer);
        if (!panel) return;

        if (s === S.HIDDEN) {
            panel.style.display = 'none';
            clearInterval(timerIv);

        } else if (s === S.APPEARING) {
            panel.style.display   = 'block';
            panel.style.opacity   = '0';
            panel.style.clipPath  = '';
            panel.style.filter    = '';
            panel.style.transform = 'translateY(-130%)';
            panel.classList.remove('pr-is-locked');
            winAmt = 0; winnerIdx = -1;
            if (lockedOv)   lockedOv.classList.remove('pr-locked-on');
            if (lockedScan) lockedScan.classList.remove('pr-scan-active');
            if (titleEl)    titleEl.textContent = (data && data.title) || '';
            buildOutcomes();
            posPanel();
            clearInterval(timerIv);
            timerIv = setInterval(updateTimer, 500);
            updateTimer();

        } else if (s === S.ACTIVE) {
            panel.style.clipPath  = '';
            panel.style.transform = '';
            panel.style.opacity   = '1';
            if (scanReveal) scanReveal.style.opacity = '0';

        } else if (s === S.LOCKED) {
            panel.classList.add('pr-is-locked');
            updateTimer();

        } else if (s === S.RESOLVED) {
            winAmt = 0;
            clearInterval(timerIv);
            if (timerEl) timerEl.textContent = '';
            var linger = (C.resultRevealMs || 2800) + (C.lingerMs || 7000);
            closeTimer = setTimeout(function () {
                if (state === S.RESOLVED) go(S.DISAPPEARING);
            }, linger);

        } else if (s === S.DISAPPEARING) {
            clearInterval(timerIv);
        }
    }

    function findWinnerIdx(eventData) {
        if (!eventData || !eventData.winningOutcomeId) return -1;
        var outcomes = eventData.outcomes || [];
        for (var i = 0; i < outcomes.length; i++) {
            if (outcomes[i].id === eventData.winningOutcomeId) return i;
        }
        return -1;
    }

    function setup() {
        var link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = 'predictionPanel.css?v=34';
        document.head.appendChild(link);
        if (!buildDOM()) return;
        posPanel();
        requestAnimationFrame(loop);
    }

    window.PredictionPanel = {
        onStart: function (d) {
            data = d; winnerIdx = -1;
            go(S.APPEARING);
        },
        onProgress: function (d) {
            data = d;
            if (state === S.HIDDEN) go(S.APPEARING);
        },
        onLocked: function (d) {
            data = d;
            if (state === S.HIDDEN) {
                go(S.APPEARING);
                setTimeout(function () { go(S.LOCKED); }, C.appearMs + 50);
            } else {
                go(S.LOCKED);
            }
        },
        onEnd: function (d) {
            data = d;
            winnerIdx = findWinnerIdx(d);
            if (state === S.HIDDEN) {
                go(S.APPEARING);
                setTimeout(function () { go(S.RESOLVED); }, C.appearMs + 50);
            } else {
                go(S.RESOLVED);
            }
        },
        hide: function () { go(S.DISAPPEARING); },
        setCfg: function (x, y, w) {
            if (x !== undefined) C.x = x;
            if (y !== undefined) C.y = y;
            if (w !== undefined) C.w = w;
            posPanel();
        },
        configure: function (opts) {
            if (opts.maxOutcomes    !== undefined) C.maxOutcomes    = opts.maxOutcomes;
            if (opts.barEasing      !== undefined) C.barEasing      = opts.barEasing;
            if (opts.resultRevealMs !== undefined) C.resultRevealMs = opts.resultRevealMs;
            if (opts.lingerMs       !== undefined) C.lingerMs       = opts.lingerMs;
        },
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setTimeout(setup, 0);
})();
