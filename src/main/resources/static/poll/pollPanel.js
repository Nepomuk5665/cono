(function(){
    'use strict';

    var C = {
        x: 80, y: 80, w: 1200,
        hudColor: '#c06020',
        winnerColor: '#f0c030',
        cancelColor: '#8a1808',
        maxOpts: 5,
        resultRevealMs: 2800,
        lingerMs: 7000,
        appearMs: 1100,
        disappearMs: 700,
        barEasing: 0.42,
    };

    var IMG_W = 1536, IMG_H = 1024;

    var S = { HIDDEN:0, APPEARING:1, ACTIVE:2, FROZEN:3, RESOLVED:4, DISAPPEARING:5 };
    var state = S.HIDDEN, ts = 0;
    var pollData = null;
    var animPcts = [], prevVotes = [];
    var wIdx = -1;
    var winAmt = 0;

    var panel, scanReveal, timerEl, questionEl, optsEl;
    var optEls = [];
    var timerIv = null, closeTimer = null;
    var pausedAt = null, pollDuration = null;

    function buildDOM(){
        var root = document.getElementById('pollPanelRoot');
        if(!root) return false;
        var el = document.createElement('div');
        el.className = 'pp-panel';
        el.innerHTML = (
            '<div class="pp-bg"></div>' +
            '<div class="pp-scan-reveal"></div>' +
            '<div class="pp-timer-area">' +
                '<div class="pp-timer"></div>' +
            '</div>' +
            '<div class="pp-content">' +
                '<div class="pp-question"></div>' +
                '<div class="pp-options"></div>' +
            '</div>' +
            '<div class="pp-frame"></div>'
        );
        root.appendChild(el);

        panel      = el;
        scanReveal = el.querySelector('.pp-scan-reveal');
        timerEl    = el.querySelector('.pp-timer');
        questionEl = el.querySelector('.pp-question');
        optsEl     = el.querySelector('.pp-options');
        return true;
    }

    function posPanel(){
        if(!panel) return;
        panel.style.left   = C.x + 'px';
        panel.style.top    = C.y + 'px';
        panel.style.width  = C.w + 'px';
        panel.style.height = Math.round(C.w * (IMG_H / IMG_W)) + 'px';
    }

    function buildOpts(){
        if(!optsEl) return;
        var choices = pollData ? (pollData.choices || []).slice(0, C.maxOpts) : [];
        optsEl.innerHTML = '';
        optEls = []; animPcts = []; prevVotes = [];
        choices.forEach(function(c){
            var d = document.createElement('div');
            d.className = 'pp-option';
            d.innerHTML = (
                '<span class="pp-opt-label"></span>' +
                '<div class="pp-opt-track"><div class="pp-opt-bar"></div></div>' +
                '<span class="pp-opt-count">0</span>' +
                '<div class="pp-win-badge">\u25b6 WINNER</div>'
            );
            d.querySelector('.pp-opt-label').textContent = c.title;
            optsEl.appendChild(d);
            optEls.push({
                root:  d,
                bar:   d.querySelector('.pp-opt-bar'),
                count: d.querySelector('.pp-opt-count'),
            });
            animPcts.push(0);
            prevVotes.push(c.votes);
        });
    }

    function scaleDynamic(){
        if(questionEl && pollData){
            var qlen = (pollData.title || '').length;
            var qfs = qlen > 100 ? 14 : qlen > 75 ? 16 : qlen > 50 ? 18 : qlen > 30 ? 20 : 22;
            questionEl.style.fontSize = qfs + 'px';
        }
        if(!optEls.length || !pollData) return;
        var choices = (pollData.choices || []).slice(0, C.maxOpts);
        var maxLen = choices.reduce(function(m, c){ return Math.max(m, (c.title || '').length); }, 0);
        var lfs = maxLen > 35 ? 13 : maxLen > 25 ? 14 : maxLen > 18 ? 16 : maxLen > 12 ? 17 : 18;
        var cfs = maxLen > 35 ? 18 : maxLen > 25 ? 20 : maxLen > 18 ? 22 : 26;
        optEls.forEach(function(e){
            var lbl = e.root.querySelector('.pp-opt-label');
            if(lbl) lbl.style.fontSize = lfs + 'px';
            e.count.style.fontSize = cfs + 'px';
        });
    }

    function updateBars(){
        if(!pollData || !optEls.length || state === S.FROZEN) return;
        var choices = (pollData.choices || []).slice(0, C.maxOpts);
        var total = choices.reduce(function(s,c){ return s + c.votes; }, 0);
        var isCan = pollData.isCancelled;
        var isEnd = pollData.isEnd;
        var leadIdx = -1;
        if(!isEnd && total > 0) leadIdx = choices.reduce(function(b,c,i){ return c.votes > choices[b].votes ? i : b; }, 0);

        choices.forEach(function(c, i){
            if(!optEls[i]) return;
            var el = optEls[i];
            var target = total > 0 ? c.votes / total : 0;
            var diff = target - (animPcts[i] || 0);
            animPcts[i] = Math.abs(diff) < 0.001 ? target : (animPcts[i] || 0) + diff * C.barEasing;
            el.bar.style.width = (animPcts[i] * 100).toFixed(2) + '%';
            el.count.textContent = c.votes;

            if(c.votes > (prevVotes[i] || 0)){
                prevVotes[i] = c.votes;
                el.bar.classList.remove('pp-bar-flash');
                void el.bar.offsetWidth;
                el.bar.classList.add('pp-bar-flash');
            }

            var isWin  = isEnd && !isCan && i === wIdx;
            var isLost = isEnd && !isCan && wIdx >= 0 && !isWin;
            var isLead = !isEnd && i === leadIdx && total > 0;

            el.root.classList.toggle('pp-leading',  isLead && !isEnd);
            el.root.classList.toggle('pp-winner',   isWin);
            el.root.classList.toggle('pp-cancelled', isCan);

            if(isEnd && wIdx >= 0){
                var loserA = isLost ? Math.max(0.06, 1 - winAmt * 0.94) : 1;
                el.root.style.opacity   = loserA.toFixed(3);
                el.root.style.filter    = isLost ? 'blur(' + (winAmt * 1.4).toFixed(1) + 'px)' : '';
                el.root.style.transform = isWin ? 'scale(1.016) translateX(3px)' : '';
            } else {
                el.root.style.opacity   = '';
                el.root.style.filter    = '';
                el.root.style.transform = '';
            }
        });
    }

    function updateTimer(){
        if(!timerEl || !pollData || state !== S.ACTIVE) return;
        if(pollData.isEnd || !pollData.endsAt){ timerEl.textContent = ''; return; }
        var rem = Math.max(0, Math.round((new Date(pollData.endsAt) - Date.now()) / 1000));
        var m = Math.floor(rem / 60), s = rem % 60;
        timerEl.textContent = ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
        timerEl.className = 'pp-timer' + (rem < 30 && rem > 0 ? ' pp-urgent' : '');
        if(rem === 0){
            var choices = pollData.choices || [];
            var total = choices.reduce(function(s,c){ return s+c.votes; }, 0);
            var wi = total > 0 ? choices.reduce(function(b,c,i){ return c.votes>choices[b].votes?i:b; }, 0) : -1;
            pollData = Object.assign({}, pollData, { isEnd:true, isCancelled:false, winnerIdx:wi });
            wIdx = wi;
            if(window.ChickenAnim) window.ChickenAnim.onPollEnd();
            go(S.RESOLVED);
        }
    }

    function loop(now){
        requestAnimationFrame(loop);
        if(!panel || state === S.HIDDEN) return;
        var el = now - ts;

        if(state === S.APPEARING){
            var prog = Math.min(1, el / C.appearMs);
            var noise = Math.random() < 0.07 ? Math.random() * 0.12 : 0;
            var clip  = Math.max(0, Math.min(1, prog - noise));
            panel.style.clipPath = 'inset(0 0 ' + ((1 - clip) * 100).toFixed(1) + '% 0)';
            panel.style.opacity  = Math.min(1, prog * 2.5).toFixed(3);
            if(scanReveal){
                scanReveal.style.bottom  = ((1 - clip) * 100).toFixed(1) + '%';
                scanReveal.style.opacity = prog < 0.96 ? '1' : '0';
            }
            if(prog >= 1) go(S.ACTIVE);
        }

        if(state === S.DISAPPEARING){
            var prog2 = Math.min(1, el / C.disappearMs);
            var noise2 = Math.random() < 0.09 ? Math.random() * 0.08 : 0;
            var clip2  = Math.min(1, prog2 + noise2);
            panel.style.clipPath = 'inset(' + (clip2 * 100).toFixed(1) + '% 0 0 0)';
            panel.style.opacity  = Math.max(0, 1 - prog2 * 1.6).toFixed(3);
            if(prog2 >= 1) go(S.HIDDEN);
        }

        if(state === S.RESOLVED){
            winAmt = Math.min(1, el / C.resultRevealMs);
        }

        updateBars();
    }

    function go(s){
        state = s; ts = performance.now();
        clearTimeout(closeTimer);
        if(!panel) return;

        if(s === S.HIDDEN){
            panel.style.display = 'none';
            clearInterval(timerIv);
            pausedAt = null; pollDuration = null;

        } else if(s === S.APPEARING){
            panel.style.display   = 'block';
            panel.style.opacity   = '0';
            panel.style.clipPath  = 'inset(0 0 100% 0)';
            panel.style.filter    = '';
            panel.style.transform = '';
            winAmt = 0;
            if(questionEl) questionEl.textContent = (pollData && pollData.title) || '';
            buildOpts();
            scaleDynamic();
            posPanel();
        } else if(s === S.ACTIVE){
            panel.style.clipPath = '';
            panel.style.opacity  = '1';
            if(scanReveal) scanReveal.style.opacity = '0';
            if(pollData && pollData.endsAt){
                if(pausedAt !== null){
                    var pauseDur = Date.now() - pausedAt;
                    pollData.endsAt = new Date(new Date(pollData.endsAt).getTime() + pauseDur).toISOString();
                } else if(pollDuration !== null){
                    pollData.endsAt = new Date(Date.now() + pollDuration).toISOString();
                }
            }
            pausedAt = null;
            clearInterval(timerIv);
            timerIv = setInterval(updateTimer, 500);
            updateTimer();
            if(window.onPollVisible && pollData && pollData.endsAt){
                var cb = window.onPollVisible; window.onPollVisible = null;
                cb(new Date(pollData.endsAt).getTime());
            }

        } else if(s === S.FROZEN){
            clearInterval(timerIv);
            pausedAt = Date.now();

        } else if(s === S.RESOLVED){
            winAmt = 0;
            clearInterval(timerIv);
            pausedAt = null;
            if(timerEl) timerEl.textContent = '';
            var linger = C.resultRevealMs + C.lingerMs;
            closeTimer = setTimeout(function(){
                if(state !== S.RESOLVED) return;
                if(window.ChickenAnim){
                    window.ChickenAnim.onPanelDisappear(function(){ go(S.DISAPPEARING); });
                } else {
                    go(S.DISAPPEARING);
                }
            }, linger);

        } else if(s === S.DISAPPEARING){
            clearInterval(timerIv);
        }
    }

    function setup(){
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'pollPanel.css';
        document.head.appendChild(link);
        if(!buildDOM()) return;
        panel.style.setProperty('--pp-hud',    C.hudColor);
        panel.style.setProperty('--pp-winner', C.winnerColor);
        panel.style.setProperty('--pp-cancel', C.cancelColor);
        posPanel();
        requestAnimationFrame(loop);
    }

    window.PollPanel = {
        onPollStart: function(d){
            pollData = d; wIdx = -1; animPcts = []; prevVotes = [];
            pollDuration = d.displayDuration || null;
            pausedAt = null;
            go(S.APPEARING);
        },
        updatePollData: function(d){
            var savedEndsAt = pollData ? pollData.endsAt : null;
            pollData = d;
            if(savedEndsAt) pollData.endsAt = savedEndsAt;
        },
        onPollPause: function(){
            if(state === S.ACTIVE || state === S.APPEARING) go(S.FROZEN);
        },
        onPollResume: function(){
            if(state === S.FROZEN) go(S.ACTIVE);
        },
        onPollEnd: function(d){
            if(state === S.RESOLVED || state === S.DISAPPEARING || state === S.HIDDEN) return;
            pollData = d;
            wIdx = (d && d.winnerIdx !== undefined) ? d.winnerIdx : -1;
            go(S.RESOLVED);
        },
        onPollCancel: function(d){
            if(state === S.RESOLVED || state === S.DISAPPEARING || state === S.HIDDEN) return;
            pollData = d; wIdx = -1;
            go(S.RESOLVED);
        },
        setCfg: function(x, y, w){
            if(x !== undefined) C.x = x;
            if(y !== undefined) C.y = y;
            if(w !== undefined) C.w = w;
            posPanel();
        },
        hide: function(){ go(S.DISAPPEARING); },
    };

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setTimeout(setup, 0);
})();
