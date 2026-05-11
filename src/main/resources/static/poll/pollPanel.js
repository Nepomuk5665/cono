(function(){
    'use strict';

    var C = {
        x: 80, y: 80, w: 1200,
        hudColor: '#c06020',
        winnerColor: '#b89020',
        cancelColor: '#8a1808',
        maxOpts: 5,
        resultRevealMs: 2800,
        lingerMs: 7000,
        appearMs: 1100,
        disappearMs: 700,
        barEasing: 0.06,
    };

    var IMG_W = 1536, IMG_H = 1024;

    var S = { HIDDEN:0, APPEARING:1, ACTIVE:2, FROZEN:3, RESOLVED:4, DISAPPEARING:5 };
    var state = S.HIDDEN, ts = 0;
    var pollData = null;
    var animPcts = [], prevVotes = [];
    var wIdx = -1;
    var freezeAmt = 0, winAmt = 0;

    var panel, scanReveal, timerEl, questionEl, optsEl, freezeOv, frostCvs, frostCtx, resultOv;
    var optEls = [];
    var frost = [];
    var timerIv = null, closeTimer = null;

    function buildCSS(){
        var h = C.hudColor, w = C.winnerColor, cc = C.cancelColor;
        return (
'@import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Orbitron:wght@700;900&display=swap");' +

'.pp-panel{position:absolute;box-sizing:border-box;display:none;overflow:hidden;background:transparent;}' +

'.pp-frame{position:absolute;inset:0;background-image:url("PanelFrame.png");background-size:100% 100%;' +
'background-repeat:no-repeat;pointer-events:none;z-index:50;}' +

'.pp-scan-reveal{position:absolute;left:0;right:0;bottom:0;height:2px;z-index:40;pointer-events:none;opacity:0;' +
'background:linear-gradient(90deg,rgba(180,80,20,.05),rgba(180,80,20,.8),rgba(180,80,20,.05));' +
'box-shadow:0 0 10px rgba(160,60,10,.7);}' +

'.pp-timer-area{position:absolute;top:12%;left:70%;right:1%;height:8%;' +
'display:flex;align-items:center;justify-content:center;z-index:55;}' +
'.pp-timer{font:900 15px "Orbitron",monospace;color:' + h + ';letter-spacing:.06em;line-height:1;' +
'font-variant-numeric:tabular-nums;text-shadow:0 0 8px #000,0 1px 4px #000;}' +
'.pp-timer.pp-urgent{color:#ff6a00;animation:pp-blink .52s ease-in-out infinite;}' +

'.pp-content{position:absolute;top:14%;left:8%;right:8%;bottom:17%;display:flex;flex-direction:column;gap:8px;}' +

'.pp-question{overflow:hidden;max-width:65%;' +
'font:600 15px "Barlow Condensed","Arial Narrow",sans-serif;color:#d0b888;' +
'line-height:1.35;letter-spacing:.02em;' +
'text-shadow:0 0 6px #000,0 1px 3px #000,0 0 12px rgba(0,0,0,.9);}' +

'.pp-options{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;}' +

'.pp-option{display:grid;grid-template-columns:42% 1fr 13%;align-items:center;gap:8px;min-width:0;' +
'transition:opacity .35s ease,filter .35s ease,transform .25s ease;}' +

'.pp-opt-label{font:600 12px "Barlow Condensed","Arial Narrow",sans-serif;color:#c09868;' +
'letter-spacing:.03em;overflow:hidden;min-width:0;line-height:1.2;' +
'text-shadow:0 0 6px #000,0 1px 3px #000,0 0 12px rgba(0,0,0,.9);}' +

'.pp-opt-track{height:16px;background:rgba(12,6,2,.92);overflow:hidden;' +
'border:1px solid rgba(160,70,20,.22);position:relative;min-width:0;}' +
'.pp-opt-bar{height:100%;width:0%;' +
'background:' +
'repeating-linear-gradient(135deg,transparent 0,transparent 3px,rgba(0,0,0,.28) 3px,rgba(0,0,0,.28) 4px),' +
'repeating-linear-gradient(45deg,transparent 0,transparent 6px,rgba(0,0,0,.15) 6px,rgba(0,0,0,.15) 7px),' +
'linear-gradient(90deg,rgba(100,32,8,.95),rgba(160,60,16,1),rgba(100,32,8,.9));' +
'box-shadow:0 0 8px rgba(160,70,15,.3);}' +

'.pp-opt-count{font:700 20px "Barlow Condensed","Arial Narrow",sans-serif;color:' + h + ';' +
'letter-spacing:.02em;text-align:right;line-height:1;min-width:0;overflow:hidden;' +
'text-shadow:0 0 6px #000,0 1px 3px #000;}' +

'.pp-win-badge{font:700 8px "Orbitron",monospace;color:' + w + ';letter-spacing:.1em;' +
'margin-top:2px;display:none;grid-column:1/-1;text-transform:uppercase;}' +
'.pp-winner .pp-win-badge{display:block;}' +

'.pp-leading .pp-opt-bar{' +
'background:' +
'repeating-linear-gradient(135deg,transparent 0,transparent 3px,rgba(0,0,0,.26) 3px,rgba(0,0,0,.26) 4px),' +
'repeating-linear-gradient(45deg,transparent 0,transparent 6px,rgba(0,0,0,.14) 6px,rgba(0,0,0,.14) 7px),' +
'linear-gradient(90deg,rgba(130,45,10,.95),rgba(185,78,22,1),rgba(130,45,10,.9));}' +

'.pp-winner .pp-opt-label{color:' + w + ';}' +
'.pp-winner .pp-opt-count{color:' + w + ';}' +
'.pp-winner .pp-opt-bar{' +
'background:' +
'repeating-linear-gradient(135deg,transparent 0,transparent 3px,rgba(0,0,0,.18) 3px,rgba(0,0,0,.18) 4px),' +
'repeating-linear-gradient(45deg,transparent 0,transparent 6px,rgba(0,0,0,.1) 6px,rgba(0,0,0,.1) 7px),' +
'linear-gradient(90deg,rgba(130,85,8,.9),' + w + ',rgba(150,100,10,.85));}' +

'.pp-cancelled .pp-opt-bar{' +
'background:repeating-linear-gradient(135deg,transparent 0,transparent 3px,rgba(0,0,0,.22) 3px,rgba(0,0,0,.22) 4px),' +
'linear-gradient(90deg,rgba(80,10,6,.92),rgba(150,20,14,.9))!important;}' +
'.pp-cancelled .pp-opt-label{color:rgba(160,80,65,.55);}' +
'.pp-cancelled .pp-opt-count{color:rgba(160,80,65,.55);}' +

'.pp-freeze-ov{position:absolute;inset:0;background:rgba(140,50,10,.06);pointer-events:none;opacity:0;z-index:45;overflow:hidden;}' +
'.pp-freeze-cvs{position:absolute;inset:0;width:100%;height:100%;}' +
'.pp-frozen-txt{position:absolute;bottom:15%;right:8%;font:700 10px "Orbitron",monospace;letter-spacing:.12em;color:rgba(200,120,55,.7);text-transform:uppercase;}' +

'.pp-result-ov{position:absolute;top:8%;left:8%;right:8%;height:8%;' +
'display:flex;align-items:center;justify-content:center;' +
'background:rgba(0,0,0,.65);pointer-events:none;opacity:0;z-index:48;transition:opacity .45s ease;}' +
'.pp-result-txt{font:900 13px "Orbitron",monospace;letter-spacing:.16em;color:' + w + ';text-transform:uppercase;}' +

'@keyframes pp-blink{0%,100%{opacity:1}50%{opacity:.08}}' +
'@keyframes pp-bflash{' +
'0%,100%{box-shadow:0 0 8px rgba(160,70,15,.3)}' +
'50%{box-shadow:0 0 20px rgba(180,90,20,.65),0 0 32px rgba(160,70,10,.35)}}' +
'.pp-bar-flash{animation:pp-bflash .45s ease-out;}'
        );
    }

    function buildDOM(){
        var root = document.getElementById('pollPanelRoot');
        if(!root) return false;
        var el = document.createElement('div');
        el.className = 'pp-panel';
        el.innerHTML = (
            '<div class="pp-scan-reveal"></div>' +
            '<div class="pp-timer-area">' +
                '<div class="pp-timer"></div>' +
            '</div>' +
            '<div class="pp-content">' +
                '<div class="pp-question"></div>' +
                '<div class="pp-options"></div>' +
            '</div>' +
            '<div class="pp-result-ov"><div class="pp-result-txt">VOTE CONCLUDED</div></div>' +
            '<div class="pp-freeze-ov">' +
                '<canvas class="pp-freeze-cvs"></canvas>' +
                '<div class="pp-frozen-txt">VOTE HALTED</div>' +
            '</div>' +
            '<div class="pp-frame"></div>'
        );
        root.appendChild(el);

        panel      = el;
        scanReveal = el.querySelector('.pp-scan-reveal');
        timerEl    = el.querySelector('.pp-timer');
        questionEl = el.querySelector('.pp-question');
        optsEl     = el.querySelector('.pp-options');
        freezeOv   = el.querySelector('.pp-freeze-ov');
        frostCvs   = el.querySelector('.pp-freeze-cvs');
        frostCtx   = frostCvs ? frostCvs.getContext('2d') : null;
        resultOv   = el.querySelector('.pp-result-ov');
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

    function updateBars(){
        if(!pollData || !optEls.length) return;
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
            animPcts[i] = (animPcts[i] || 0) + (target - (animPcts[i] || 0)) * C.barEasing;
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
        if(!timerEl || !pollData || state === S.FROZEN) return;
        if(pollData.isEnd || !pollData.endsAt){ timerEl.textContent = ''; return; }
        var rem = Math.max(0, Math.round((new Date(pollData.endsAt) - Date.now()) / 1000));
        var m = Math.floor(rem / 60), s = rem % 60;
        timerEl.textContent = ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
        timerEl.className = 'pp-timer' + (rem < 30 && rem > 0 ? ' pp-urgent' : '');
    }

    function setupFrost(){
        if(!frostCvs || !panel) return;
        var pw = panel.offsetWidth, ph = panel.offsetHeight;
        if(pw > 0) frostCvs.width  = pw;
        if(ph > 0) frostCvs.height = ph;
    }

    function tickFrost(){
        if(!frostCvs || !frostCtx || freezeAmt < 0.01) return;
        var w = frostCvs.width, h = frostCvs.height;
        if(!w || !h){ setupFrost(); return; }
        if(state === S.FROZEN && freezeAmt > 0.3 && frost.length < 32 && Math.random() < 0.2){
            frost.push({ x:Math.random()*w, y:Math.random()*h, vx:(Math.random()-.5)*.45, vy:-Math.random()*.7-.1, life:1, r:Math.random()*2.5+1.3 });
        }
        for(var i = frost.length - 1; i >= 0; i--){
            var p = frost[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.013;
            if(p.life <= 0) frost.splice(i, 1);
        }
        frostCtx.clearRect(0, 0, w, h);
        if(freezeAmt > 0.35){
            frostCtx.strokeStyle = 'rgba(190,110,40,' + (freezeAmt * 0.4) + ')';
            frostCtx.lineWidth = 1;
            [[40,16],[108,38],[218,19],[316,33],[w-38,13],[78,66],[w-105,50],[158,8],[w-62,68],[w-180,90]].forEach(function(pt){
                if(pt[0] > w || pt[1] > h) return;
                var sz = 5 + (pt[0] % 5);
                frostCtx.beginPath();
                frostCtx.moveTo(pt[0]-sz,pt[1]); frostCtx.lineTo(pt[0]+sz,pt[1]);
                frostCtx.moveTo(pt[0],pt[1]-sz); frostCtx.lineTo(pt[0],pt[1]+sz);
                frostCtx.moveTo(pt[0]-sz*.7,pt[1]-sz*.7); frostCtx.lineTo(pt[0]+sz*.7,pt[1]+sz*.7);
                frostCtx.moveTo(pt[0]+sz*.7,pt[1]-sz*.7); frostCtx.lineTo(pt[0]-sz*.7,pt[1]+sz*.7);
                frostCtx.stroke();
            });
        }
        frost.forEach(function(p){
            frostCtx.fillStyle = 'rgba(190,110,40,' + (p.life * freezeAmt * 0.7) + ')';
            frostCtx.beginPath(); frostCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); frostCtx.fill();
        });
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

        if(state === S.FROZEN) freezeAmt = Math.min(1, freezeAmt + 0.015);
        else                   freezeAmt = Math.max(0, freezeAmt - 0.013);
        if(freezeOv) freezeOv.style.opacity = freezeAmt.toFixed(3);
        if(freezeAmt > 0.01) tickFrost();

        if(state === S.RESOLVED){
            winAmt = Math.min(1, el / C.resultRevealMs);
            if(resultOv && winAmt > 0.55){
                resultOv.style.opacity = Math.min(1, (winAmt - 0.55) / 0.3).toFixed(3);
            }
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
            frost = [];

        } else if(s === S.APPEARING){
            panel.style.display   = 'block';
            panel.style.opacity   = '0';
            panel.style.clipPath  = 'inset(0 0 100% 0)';
            panel.style.filter    = '';
            panel.style.transform = '';
            freezeAmt = 0; winAmt = 0;
            if(freezeOv) freezeOv.style.opacity = '0';
            if(resultOv) resultOv.style.opacity  = '0';
            if(questionEl) questionEl.textContent = (pollData && pollData.title) || '';
            buildOpts();
            posPanel();
            setupFrost();
            clearInterval(timerIv);
            timerIv = setInterval(updateTimer, 500);

        } else if(s === S.ACTIVE){
            panel.style.clipPath = '';
            panel.style.opacity  = '1';
            if(scanReveal) scanReveal.style.opacity = '0';

        } else if(s === S.RESOLVED){
            winAmt = 0;
            clearInterval(timerIv);
            if(timerEl) timerEl.textContent = '';
            var isCan = pollData && pollData.isCancelled;
            if(resultOv){
                resultOv.style.opacity = '0';
                var rtxt = resultOv.querySelector('.pp-result-txt');
                if(rtxt){
                    rtxt.textContent = isCan ? 'VOTE ANNULLED' : 'VOTE CONCLUDED';
                    rtxt.style.color = isCan ? C.cancelColor : C.winnerColor;
                }
            }
            var linger = (C.resultRevealMs || 2800) + (C.lingerMs || 7000);
            closeTimer = setTimeout(function(){ if(state === S.RESOLVED) go(S.DISAPPEARING); }, linger);

        } else if(s === S.DISAPPEARING){
            clearInterval(timerIv);
        }
    }

    function setup(){
        var styleEl = document.createElement('style');
        styleEl.textContent = buildCSS();
        document.head.appendChild(styleEl);
        if(!buildDOM()) return;
        posPanel();
        requestAnimationFrame(loop);
    }

    window.PollPanel = {
        onPollStart: function(d){
            pollData = d; wIdx = -1; animPcts = []; prevVotes = [];
            go(S.APPEARING);
        },
        updatePollData: function(d){ pollData = d; },
        onPollPause: function(){
            if(state === S.ACTIVE || state === S.APPEARING) go(S.FROZEN);
        },
        onPollResume: function(){
            if(state === S.FROZEN) go(S.ACTIVE);
        },
        onPollEnd: function(d){
            pollData = d;
            wIdx = (d && d.winnerIdx !== undefined) ? d.winnerIdx : -1;
            go(S.RESOLVED);
        },
        onPollCancel: function(d){
            pollData = d; wIdx = -1;
            go(S.RESOLVED);
        },
        setCfg: function(x, y, w){
            if(x !== undefined) C.x = x;
            if(y !== undefined) C.y = y;
            if(w !== undefined) C.w = w;
            posPanel();
        },
        configure: function(opts){
            if(opts.maxOpts        !== undefined) C.maxOpts        = opts.maxOpts;
            if(opts.barEasing      !== undefined) C.barEasing      = opts.barEasing;
            if(opts.resultRevealMs !== undefined) C.resultRevealMs = opts.resultRevealMs;
            if(opts.lingerMs       !== undefined) C.lingerMs       = opts.lingerMs;
        },
        hide: function(){ go(S.DISAPPEARING); },
    };

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setTimeout(setup, 0);
})();
