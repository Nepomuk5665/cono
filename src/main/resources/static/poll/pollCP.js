let backend = null;
let selectedPos = 'top-left';
let debounceTimer = null;
let _previewScale = 1;
let _pollEndsAt = null;
let _pausedAt = null;
let _timerInterval = null;
let _simInterval = null;
let _simVotes = [];

const _SAVE_KEY      = 'pollCP_v8';
const _SEC_KEY       = 'pollCP_sections';
const _POLL_STATE_KEY = 'pollCP_activeState';


window._updateDragHandles = function(scale) {
    _previewScale = scale;
    const guides = document.getElementById('dragGuides');
    if (!guides) return;
    guides.innerHTML = '';
    const px = parseInt(document.getElementById('panelX').value) || 40;
    const py = parseInt(document.getElementById('panelY').value) || 40;
    const pw = parseInt(document.getElementById('panelW').value) || 460;
    const ph = 480;
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.style.cssText = 'left:'+(px*scale).toFixed(1)+'px;top:'+(py*scale).toFixed(1)+'px;width:'+(pw*scale).toFixed(1)+'px;height:'+(ph*scale).toFixed(1)+'px';
    handle.innerHTML = '<div class="resize-corner"></div>';
    const corner = handle.querySelector('.resize-corner');
    corner.addEventListener('mousedown', function(e){
        e.stopPropagation(); e.preventDefault();
        const startX = e.clientX, startW = pw;
        function onMove(e2){ const newW = Math.max(200, Math.min(1200, Math.round(startW + (e2.clientX - startX) / _previewScale))); document.getElementById('panelW').value = newW; autoSendDebounced(60); window._updateDragHandles(_previewScale); }
        function onUp(){ document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
    handle.addEventListener('mousedown', function(e){
        if (e.target === corner) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY, startPx = px, startPy = py;
        handle.classList.add('dragging');
        function onMove(e2){ const newPx = Math.max(0, Math.min(1920-pw, Math.round(startPx+(e2.clientX-startX)/_previewScale))); const newPy = Math.max(0, Math.min(980, Math.round(startPy+(e2.clientY-startY)/_previewScale))); document.getElementById('panelX').value = newPx; document.getElementById('panelY').value = newPy; autoSendDebounced(60); window._updateDragHandles(_previewScale); }
        function onUp(){ handle.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
    guides.appendChild(handle);
};


function buildConfig(){
    return { cmd: 'pollConfig', panelW: parseInt($('#panelW').val()), panelPosition: selectedPos, panelX: parseInt($('#panelX').val()), panelY: parseInt($('#panelY').val()) };
}

function saveState(){
    localStorage.setItem(_SAVE_KEY, JSON.stringify({
        panelW: $('#panelW').val(), panelX: $('#panelX').val(), panelY: $('#panelY').val(),
        chickenRot: $('#chickenRot').val(),
        chickenVisible: $('#chickenVisible').hasClass('on'),
    }));
}

function restoreState(){
    const raw = localStorage.getItem(_SAVE_KEY);
    if (!raw) return;
    try {
        const d = JSON.parse(raw);
        if (d.panelW) $('#panelW').val(d.panelW);
        if (d.panelX) $('#panelX').val(d.panelX);
        if (d.chickenRot) { $('#chickenRot').val(d.chickenRot); $('#chickenRotVal').text(d.chickenRot+'°'); }
        if (d.chickenVisible === false) { setChickenBtn(false); }
    } catch(e){}
}

function setChickenBtn(on){
    var btn = $('#chickenVisible');
    btn.toggleClass('on', on).toggleClass('chk-on', on).toggleClass('chk-off', !on);
    btn.text(on ? 'Chicken' : 'Chicken Off');
}

function send(obj){
    if (typeof onCommandReceived === 'function') onCommandReceived(obj);
    if (backend) { try { backend.sendObject('/app/object', obj); } catch(e){} }
}

function autoSend(){
    saveState(); send(buildConfig());
    send({ cmd: 'chickenCfg',
        rotation: parseInt($('#chickenRot').val()) || 0,
        rotationX: parseInt($('#chickenRotX').val()) || 0,
        entryDir: 'top-left',
    });
    send({ cmd: 'chickenVisible', visible: $('#chickenVisible').hasClass('on') });
    if (window._updateDragHandles) window._updateDragHandles(_previewScale);
}
function autoSendDebounced(ms){ clearTimeout(debounceTimer); debounceTimer = setTimeout(autoSend, ms || 350); }


function doEmergencyHide(){
    if (window.ChickenAnim) window.ChickenAnim.onPollCancel();
    if (window.PollPanel)   window.PollPanel.hide();
}

function savePollState(event, endsAt){
    try { localStorage.setItem(_POLL_STATE_KEY, JSON.stringify({ event: event, endsAt: new Date(endsAt).toISOString() })); } catch(e){}
}

function clearPollState(){
    localStorage.removeItem(_POLL_STATE_KEY);
}

function tryRestorePoll(){
    var raw = localStorage.getItem(_POLL_STATE_KEY);
    if(!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch(e){ clearPollState(); return; }
    var remaining = new Date(saved.endsAt) - Date.now();
    if(remaining <= 1000){ clearPollState(); return; }
    var ev = Object.assign({}, saved.event, {
        _restore: true,
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + remaining).toISOString(),
    });
    _pollEndsAt = Date.now() + remaining;
    window.onPollVisible = function(e){ window.onPollVisible = null; startTimer(e); };
    $('#apStart').addClass('on'); $('#apPause').removeClass('on'); $('#apEnd').removeClass('on');
    if(typeof applyPollEvent === 'function') applyPollEvent(ev);
}

function startTimer(endsAt) {
    _pollEndsAt = endsAt;
    clearInterval(_timerInterval);
    _timerInterval = setInterval(function() {
        var el = document.getElementById('pollTimer');
        if (!el) return;
        var left = Math.max(0, Math.round((_pollEndsAt - Date.now()) / 1000));
        var m = Math.floor(left / 60);
        var s = left % 60;
        el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        el.className = left === 0 ? '' : (left <= 15 ? 'urgent' : 'running');
        if (left === 0) {
            clearInterval(_timerInterval);
            clearInterval(_simInterval); _simInterval = null;
            $('#apSimulate').removeClass('on');
            $('#apEnd').addClass('on'); $('#apStart').removeClass('on'); $('#apPause').removeClass('on');
            send({ cmd: 'pollReveal' });
        }
    }, 500);
}

function stopTimer() {
    clearInterval(_timerInterval);
    var el = document.getElementById('pollTimer');
    if (el) { el.textContent = '--:--'; el.className = ''; }
}


function _doFreeze(){
    send({ cmd: 'pollPause' });
}

function _doResume(){
    send({ cmd: 'pollResume' });
}

function _doEnd(){
    send({ cmd: 'pollReveal' });
}

function _doCancel(){
    doEmergencyHide();
}

function initCollapsible(){
    const stored = JSON.parse(localStorage.getItem(_SEC_KEY) || '{}');
    document.querySelectorAll('.sec-head[data-sec]').forEach(function(head){
        const secId = head.dataset.sec;
        const body  = head.nextElementSibling;
        let shouldCollapse;
        if (stored.hasOwnProperty(secId)) {
            shouldCollapse = stored[secId] === true;
        } else {
            shouldCollapse = head.closest('.sec').hasAttribute('data-default-collapsed');
        }
        if (shouldCollapse) { head.classList.add('collapsed'); body.classList.add('collapsed'); }
        head.addEventListener('click', function(e){
            const collapsed = body.classList.toggle('collapsed');
            head.classList.toggle('collapsed', collapsed);
            const s = JSON.parse(localStorage.getItem(_SEC_KEY) || '{}');
            s[secId] = collapsed;
            localStorage.setItem(_SEC_KEY, JSON.stringify(s));
        });
    });
}


function initKeyboardShortcuts(){
    document.addEventListener('keydown', function(e){
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey) return;
        switch(e.key.toUpperCase()){
            case 'E': autoSend();        break;
            case 'F': _doFreeze();       break;
            case 'R': _doResume();       break;
            case 'W': _doEnd();          break;
            case 'C': _doCancel();       break;
            case 'H': doEmergencyHide(); break;
        }
    });
}


$(function(){
    restoreState();
    initCollapsible();
    initKeyboardShortcuts();

    $('#apStart').click(function(){
        $('#apStart').addClass('on'); $('#apPause').removeClass('on'); $('#apEnd').removeClass('on');
        autoSend();
        const now = Date.now();
        const endsAt = now + 120000;
        _pollEndsAt = endsAt;
        window.onPollVisible = function(e){ window.onPollVisible = null; startTimer(e); };
        var startEvent = {
            id: 'dev-test', eventType: 'START', status: 'active',
            title: 'Welches ist das absolut beste Spiel das du je in deinem ganzen Leben gespielt hast und warum?',
            startedAt: new Date(now).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
            pollChoices: [
                { title: 'The Legend of Zelda: Breath of the Wild', totalVotes: 120, channelPointVotes: 0 },
                { title: 'Elden Ring – Shadow of the Erdtree Edition', totalVotes:  55, channelPointVotes: 0 },
                { title: 'Red Dead Redemption 2', totalVotes:  30, channelPointVotes: 0 },
            ],
        };
        savePollState(startEvent, endsAt);
        send({ cmd: 'pollTest', event: startEvent });
    });
    $('#apPause').click(function(){
        if ($('#apPause').hasClass('on')) {
            if(_pausedAt !== null){ _pollEndsAt += Date.now() - _pausedAt; _pausedAt = null; }
            startTimer(_pollEndsAt);
            $('#apPause').removeClass('on'); $('#apStart').addClass('on');
            send({ cmd: 'pollResume' });
        } else {
            _pausedAt = Date.now();
            clearInterval(_timerInterval);
            $('#apPause').addClass('on'); $('#apStart').removeClass('on');
            send({ cmd: 'pollPause' });
        }
    });
    $('#apEnd').click(function(){
        stopTimer();
        clearPollState();
        clearInterval(_simInterval); _simInterval = null;
        $('#apEnd').addClass('on'); $('#apStart').removeClass('on'); $('#apPause').removeClass('on'); $('#apSimulate').removeClass('on');
        send({ cmd: 'pollReveal' });
    });

    $('#apSimulate').click(function(){
        if(_simInterval){
            clearInterval(_simInterval); _simInterval = null;
            $(this).removeClass('on');
            return;
        }
        _simVotes = [120, 55, 30];
        $(this).addClass('on');
        var _simTick = 0;
        _simInterval = setInterval(function(){
            _simTick++;
            var bursts = Math.random() < 0.25 ? 3 : 1;
            for(var b = 0; b < bursts; b++){
                var idx = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * _simVotes.length);
                _simVotes[idx] += Math.floor(Math.random() * 18) + 2;
            }
            if(_simTick % 8 === 0){
                var spike = Math.floor(Math.random() * _simVotes.length);
                _simVotes[spike] += Math.floor(Math.random() * 40) + 15;
            }
            send({ cmd: 'pollTest', event: {
                id: 'dev-test', eventType: 'PROGRESS', status: 'active',
                title: 'Welches ist das absolut beste Spiel das du je in deinem ganzen Leben gespielt hast und warum?',
                startedAt: new Date().toISOString(),
                endsAt: new Date(_pollEndsAt || Date.now() + 60000).toISOString(),
                pollChoices: [
                    { title: 'The Legend of Zelda: Breath of the Wild', totalVotes: _simVotes[0], channelPointVotes: 0 },
                    { title: 'Elden Ring – Shadow of the Erdtree Edition', totalVotes: _simVotes[1], channelPointVotes: 0 },
                    { title: 'Red Dead Redemption 2', totalVotes: _simVotes[2], channelPointVotes: 0 },
                ],
            }});
        }, 400);
    });

    setChickenBtn(true);
    $('#chickenVisible').click(function(){
        var on = !$(this).hasClass('on');
        setChickenBtn(on);
        send({ cmd: 'chickenVisible', visible: on });
        saveState();
    });

    $('#chickenRot').on('input', function(){
        const v = parseInt($(this).val()); $('#chickenRotVal').text(v+'°');
        send({ cmd: 'chickenCfg', rotation: v });
    });
    $('#chickenRotX').on('input', function(){
        const v = parseInt($(this).val()); $('#chickenRotXVal').text(v+'°');
        send({ cmd: 'chickenCfg', rotationX: v });
    });

    autoSend();
    backend = new Backend(function(b){
        b.subscribe('/topic/channelPollReceived', function(event){
            if(event.eventType === 'START'){
                savePollState(event, event.endsAt);
                _pollEndsAt = new Date(event.endsAt).getTime();
                window.onPollVisible = function(e){ window.onPollVisible = null; startTimer(e); };
                $('#apStart').addClass('on'); $('#apPause').removeClass('on'); $('#apEnd').removeClass('on');
                if(typeof applyPollEvent === 'function') applyPollEvent(event);
            } else if(event.eventType === 'PROGRESS'){
                savePollState(event, event.endsAt);
                if(typeof applyPollEvent === 'function') applyPollEvent(event);
            } else if(event.eventType === 'END'){
                clearPollState();
                stopTimer();
                _pausedAt = null;
                clearInterval(_simInterval); _simInterval = null;
                $('#apEnd').addClass('on'); $('#apStart').removeClass('on'); $('#apPause').removeClass('on'); $('#apSimulate').removeClass('on');
            }
        });
    });
    tryRestorePoll();
});
