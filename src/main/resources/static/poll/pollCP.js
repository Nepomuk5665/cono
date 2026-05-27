let backend = null;
let selectedPos = 'top-left';
let debounceTimer = null;
let _previewScale = 1;
let _pollEndsAt = null;
let _timerInterval = null;

const _SAVE_KEY = 'pollCP_v7';
const _SEC_KEY  = 'pollCP_sections';


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
    } catch(e){}
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
    if (window._updateDragHandles) window._updateDragHandles(_previewScale);
}
function autoSendDebounced(ms){ clearTimeout(debounceTimer); debounceTimer = setTimeout(autoSend, ms || 350); }


function doEmergencyHide(){
    if (window.ChickenAnim) window.ChickenAnim.onPollCancel();
    if (window.PollPanel)   window.PollPanel.hide();
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
        if (left === 0) { clearInterval(_timerInterval); }
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

    $('#apStart').click(function(){ autoSend(); send({ cmd: 'pollShow' }); });
    $('#apPause').click(function(){ send({ cmd: 'pollPause' }); });
    $('#apEnd').click(function(){ stopTimer(); send({ cmd: 'pollReveal' }); });

    $('#chickenShow').click(function(){
        $('#chickenShow').addClass('on'); $('#chickenHide').removeClass('on');
        send({ cmd: 'pollShow' });
    });
    $('#chickenHide').click(function(){
        $('#chickenHide').addClass('on'); $('#chickenShow').removeClass('on');
        send({ cmd: 'pollHide' });
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
    backend = new Backend();
});
