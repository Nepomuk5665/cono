let backend = null;
let selectedPos = 'top-left';
let debounceTimer = null;
let _previewScale = 1;

const _SAVE_KEY = 'pollCP_v3';
const _SEC_KEY  = 'pollCP_sections';


const Presets = {
    KEY: 'pollCP_presets_v1',
    SLOTS: 8,
    slots: [],
    activeIdx: -1,

    load() {
        try { this.slots = JSON.parse(localStorage.getItem(this.KEY)) || []; } catch(e) { this.slots = []; }
        while (this.slots.length < this.SLOTS) this.slots.push(null);
        this.render();
    },

    _capture() {
        return {
            panelW: $('#panelW').val(), panelX: $('#panelX').val(), panelY: $('#panelY').val(),
            selectedPos,
            chickenSize: $('#chickenSize').val(), chickenRot: $('#chickenRot').val(),
            chickenExitDir: $('[data-exit].on').data('exit') || 'right',
            chickenEntryDir: $('[data-entry].on').data('entry') || 'top-left',
            panelDelay: $('#panelDelay').val(), maxOpts: $('#maxOpts').val(),
        };
    },

    save(idx) {
        const name = (document.getElementById('presetNameInput').value || ('Preset ' + (idx+1))).trim();
        this.slots[idx] = Object.assign({ name, savedAt: Date.now() }, this._capture());
        localStorage.setItem(this.KEY, JSON.stringify(this.slots));
        this.activeIdx = idx;
        this.render();
    },

    apply(idx) {
        const p = this.slots[idx];
        if (!p) return;
        if (p.panelW)       $('#panelW').val(p.panelW);
        if (p.panelX)       $('#panelX').val(p.panelX);
        if (p.panelY)       $('#panelY').val(p.panelY);
        if (p.chickenSize)  { $('#chickenSize').val(p.chickenSize); $('#chickenSizeVal').text(p.chickenSize); }
        if (p.chickenRot)   { $('#chickenRot').val(p.chickenRot);   $('#chickenRotVal').text(p.chickenRot+'°'); }
        if (p.panelDelay)   { $('#panelDelay').val(p.panelDelay); document.getElementById('panelDelayVal').textContent = (p.panelDelay/1000).toFixed(1)+'s'; }
        if (p.selectedPos)  { selectedPos = p.selectedPos; $('#posGrid .pos-cell').removeClass('on'); $('[data-pos="'+p.selectedPos+'"]').addClass('on'); }
        if (p.chickenExitDir)  { $('[data-exit]').removeClass('on');  $('[data-exit="'+p.chickenExitDir+'"]').addClass('on'); }
        if (p.chickenEntryDir) { $('[data-entry]').removeClass('on'); $('[data-entry="'+p.chickenEntryDir+'"]').addClass('on'); }
        this.activeIdx = idx;
        this.render();
        autoSend();
    },

    clear(idx) {
        this.slots[idx] = null;
        if (this.activeIdx === idx) this.activeIdx = -1;
        localStorage.setItem(this.KEY, JSON.stringify(this.slots));
        this.render();
    },

    exportJSON() {
        const ta = document.getElementById('presetJsonArea');
        ta.style.display = 'block';
        ta.value = JSON.stringify(this.slots, null, 2);
    },

    render() {
        const container = document.getElementById('presetSlots');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < this.SLOTS; i++) {
            const btn = document.createElement('button');
            const p = this.slots[i];
            btn.className = 'preset-slot' + (p ? ' filled' : '') + (i === this.activeIdx ? ' on' : '');
            btn.textContent = p ? p.name.slice(0, 12) : '[' + (i+1) + ']';
            btn.title = p ? (p.name + '\nSaved: ' + new Date(p.savedAt).toLocaleString() + '\nRight-click to clear') : 'Empty — click to save current settings';
            btn.onclick = function() {
                if (!Presets.slots[i]) {
                    const inp = document.getElementById('presetNameInput');
                    if (!inp.value) inp.value = 'Preset ' + (i+1);
                    Presets.save(i);
                } else {
                    Presets.apply(i);
                }
            };
            btn.oncontextmenu = function(e) { e.preventDefault(); if (Presets.slots[i]) Presets.clear(i); };
            container.appendChild(btn);
        }
    },
};

const AI_NAMES = { 0:'walk',1:'salto',2:'lookUp',3:'bow',4:'dance1',5:'wave',6:'walkUp',7:'dance2',9:'freeze1',10:'freeze2' };

function makeSeq(defaultSeq, cfgKey) {
    return {
        sequence: defaultSeq,
        render(containerId) {
            const wrap = document.getElementById(containerId);
            if (!wrap) return;
            wrap.innerHTML = '';
            const self = this;
            this.sequence.forEach(function(idx, i) {
                const pill = document.createElement('div');
                pill.className = 'seq-pill';
                pill.innerHTML = idx + ' <span style="color:#555">' + (AI_NAMES[idx]||'?') + '</span><span class="seq-del" data-i="' + i + '">×</span>';
                pill.querySelector('.seq-del').onclick = function() { self.sequence.splice(i, 1); self.render(containerId); self.send(); };
                wrap.appendChild(pill);
            });
        },
        add(val, containerId) { this.sequence.push(parseInt(val)); this.render(containerId); this.send(); },
        send() { if (window.chickenCfg) window.chickenCfg[cfgKey] = this.sequence.slice(); },
    };
}

const CelebSeq = makeSeq([4, 7, 3], 'celebrationSequence');
const ExitSeq  = makeSeq([6, 1], 'exitSequence');


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
        selectedPos,
        chickenSize: $('#chickenSize').val(), chickenRot: $('#chickenRot').val(),
        panelDelay: $('#panelDelay').val(), maxOpts: $('#maxOpts').val(),
        celebSeq: CelebSeq.sequence, exitSeq: ExitSeq.sequence,
    }));
}

function restoreState(){
    const raw = localStorage.getItem(_SAVE_KEY);
    if (!raw) return;
    try {
        const d = JSON.parse(raw);
        if (d.panelW)      $('#panelW').val(d.panelW);
        if (d.panelX)      $('#panelX').val(d.panelX);
        if (d.panelY)      $('#panelY').val(d.panelY);
        if (d.chickenSize) { $('#chickenSize').val(d.chickenSize); $('#chickenSizeVal').text(d.chickenSize); }
        if (d.chickenRot)  { $('#chickenRot').val(d.chickenRot);   $('#chickenRotVal').text(d.chickenRot+'°'); }
        if (d.panelDelay)  { $('#panelDelay').val(d.panelDelay); document.getElementById('panelDelayVal').textContent = (d.panelDelay/1000).toFixed(1)+'s'; }
        if (d.maxOpts)     { $('#maxOpts').val(d.maxOpts); document.getElementById('maxOptsVal').textContent = d.maxOpts; }
        if (d.selectedPos) { selectedPos = d.selectedPos; $('#posGrid .pos-cell').removeClass('on'); $('[data-pos="'+d.selectedPos+'"]').addClass('on'); }
        if (d.celebSeq)    CelebSeq.sequence = d.celebSeq;
        if (d.exitSeq)     ExitSeq.sequence = d.exitSeq;
    } catch(e){}
}

function send(obj){
    if (typeof onCommandReceived === 'function') onCommandReceived(obj);
    if (backend) backend.sendObject('/app/object', obj);
}

function autoSend(){
    saveState(); send(buildConfig());
    if (window._updateDragHandles) window._updateDragHandles(_previewScale);
}
function autoSendDebounced(ms){ clearTimeout(debounceTimer); debounceTimer = setTimeout(autoSend, ms || 350); }


function doEmergencyHide(){
    if (window.ChickenAnim) window.ChickenAnim.onPollCancel();
    if (window.PollPanel)   window.PollPanel.hide();
}


function _doTestPoll(){
    autoSend();
    const now = Date.now();
    send({ cmd: 'pollTest', event: {
        id: 'dev-test',
        eventType: 'START',
        status: 'active',
        title: 'Which ship class should our fleet doctrine focus on for the next campaign?',
        startedAt: new Date(now).toISOString(),
        endsAt: new Date(now + 120000).toISOString(),
        pollChoices: [
            { title: 'Minmatar Battleship Fleet',    totalVotes: 124, channelPointVotes: 0 },
            { title: 'Caldari Stealth Bombers',      totalVotes:  56, channelPointVotes: 0 },
            { title: 'Amarr Heavy Assault Cruisers', totalVotes:  38, channelPointVotes: 0 },
        ],
    }});
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
    Presets.load();
    CelebSeq.render('celebSeq');
    ExitSeq.render('exitSeq');
    initKeyboardShortcuts();

    $('input[type=number]').on('input', function(){ autoSendDebounced(300); });

    $('#apTest').click(function(){ _doTestPoll(); });
    $('#apStart').click(autoSend);
    $('#apProgress').click(function(){ autoSend(); });
    $('#apFreeze').click(function(){ _doFreeze(); });
    $('#apUnfreeze').click(function(){ _doResume(); });
    $('#apReveal').click(function(){ _doEnd(); });
    $('#apCancel').click(function(){ _doCancel(); });
    $('#apHide').click(function(){ doEmergencyHide(); });


    $('#posGrid .pos-cell').click(function(){
        $('#posGrid .pos-cell').removeClass('on'); $(this).addClass('on');
        selectedPos = $(this).data('pos'); autoSend();
    });
    $('#resetPos').click(function(){ $('#panelX').val(40); $('#panelY').val(40); autoSend(); });
    $('#resetSize').click(function(){ $('#panelW').val(460); autoSend(); });

    document.getElementById('preview-area').style.background = '#0d0d0d';

    $('#chickenSize').on('input', function(){
        const v = parseInt($(this).val()); $('#chickenSizeVal').text(v); send({ cmd: 'chickenCfg', size: v });
    });
    $('#chickenRot').on('input', function(){
        const v = parseInt($(this).val()); $('#chickenRotVal').text(v+'°'); send({ cmd: 'chickenCfg', rotation: v });
    });
    $('[data-exit]').click(function(){
        $('[data-exit]').removeClass('on'); $(this).addClass('on');
        send({ cmd: 'chickenCfg', exitDir: $(this).data('exit') });
    });
    $('[data-entry]').click(function(){
        $('[data-entry]').removeClass('on'); $(this).addClass('on');
        send({ cmd: 'chickenCfg', entryDir: $(this).data('entry') });
    });
    $('#resetChicken').click(function(){
        $('#chickenSize').val(220); $('#chickenSizeVal').text(220);
        $('#chickenRot').val(-27);  $('#chickenRotVal').text('-27°');
        $('[data-exit]').removeClass('on');  $('[data-exit="right"]').addClass('on');
        $('[data-entry]').removeClass('on'); $('[data-entry="top-left"]').addClass('on');
        send({ cmd: 'chickenCfg', size: 220, rotation: -27, exitDir: 'right', entryDir: 'top-left' });
    });

    $('#panelDelay').on('input', function(){
        const v = parseInt($(this).val());
        document.getElementById('panelDelayVal').textContent = (v/1000).toFixed(1)+'s';
        cfg.panelDelay = v;
    });
    $('#maxOpts').on('input', function(){
        const v = parseInt($(this).val());
        document.getElementById('maxOptsVal').textContent = v;
        if (window.PollPanel)  window.PollPanel.configure({ maxOpts: v });
    });
    $('#barEasing').on('input', function(){
        const v = parseInt($(this).val());
        const easing = parseFloat((v / 100).toFixed(2));
        document.getElementById('barEasingVal').textContent = easing.toFixed(2);
        if (window.PollPanel) window.PollPanel.configure({ barEasing: easing });
    });
    $('#resultRevealMs').on('input', function(){
        const v = parseInt($(this).val()) || 2800;
        if (window.chickenCfg) window.chickenCfg.resultRevealDuration = v;
        if (window.PollPanel)  window.PollPanel.configure({ resultRevealMs: v });
    });
    $('#lingerMs').on('input', function(){
        const v = parseInt($(this).val()) || 7000;
        if (window.PollPanel) window.PollPanel.configure({ lingerMs: v });
    });

    $('[data-celmode]').click(function(){
        $('[data-celmode]').removeClass('on'); $(this).addClass('on');
        if (window.chickenCfg) window.chickenCfg.celebrationMode = $(this).data('celmode');
    });
    $('#celebAddBtn').click(function(){ CelebSeq.add($('#celebAddSel').val(), 'celebSeq'); });
    $('#celebPreview').click(function(){
        if (window.ChickenAnim && CelebSeq.sequence.length) {
            CelebSeq.sequence.forEach(function(idx, i){
                setTimeout(function(){ if (window.ChickenAnim) window.ChickenAnim.previewAnim(idx); }, i * 1000);
            });
        }
    });

    $('#exitAddBtn').click(function(){ ExitSeq.add($('#exitAddSel').val(), 'exitSeq'); });

    $('#presetSaveBtn').click(function(){
        const empty = Presets.slots.findIndex(function(s){ return !s; });
        const idx = empty >= 0 ? empty : 0;
        Presets.save(idx);
    });
    $('#presetExport').click(function(){ Presets.exportJSON(); });
    $('#safetyStopAnims').click(function(){
        if (window.ChickenAnim) window.ChickenAnim.previewAnim(0);
    });
    $('#resetAllBtn').click(function(){
        if (confirm('Reset all settings to defaults?')) { localStorage.removeItem(_SAVE_KEY); location.reload(); }
    });

    autoSend();

    backend = new Backend();
});
