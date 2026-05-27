let backend = null;
let mockId  = null;
let mockOutcomeIds = [];
let selectedPos = 'top-left';
let workflowStep = 0;

const PANEL_DIMS = { x: 60, y: 60, w: 480 };
const FRAME_W = 1024, FRAME_H = 1536;

function setWorkflowStep(step) {
    workflowStep = step;
    const steps = ['#apStart', '#apProgress', '#apLocked', '#apResolve'];
    steps.forEach((sel, i) => {
        const $s = $(sel);
        $s.removeClass('next active done');
        if (i + 1 < step)            $s.addClass('done');
        else if (i + 1 === step)     $s.addClass('active');
        else if (i + 1 === step + 1) $s.addClass('next');
    });
    if (step >= 3) $('#apWinnerPick').show();
    else           $('#apWinnerPick').hide();
}

function rebuildWinnerButtons() {
    const $wrap = $('#apWinnerBtns');
    $wrap.empty();
    const rows = getOutcomeRows();
    rows.each((i, row) => {
        const title = $(row).find('.out-title').val() || `#${i + 1}`;
        const btn = $(`<button class="ap-winner-btn" type="button">${title}</button>`);
        btn.click(() => fireEndForIndex(i));
        $wrap.append(btn);
    });
}

function getOutcomeRows() { return $('#cp-outcomes-form .out-row'); }

function colorClassForIdx(i, total) {
    if (total === 2 && i === 0) return 'is-blue';
    if (total === 2 && i === 1) return 'is-pink';
    return '';
}

function refreshOutcomeNumbers() {
    const rows = getOutcomeRows();
    const total = rows.length;
    rows.each((i, row) => {
        const $num = $(row).find('.out-num');
        $num.removeClass('is-blue is-pink').addClass(colorClassForIdx(i, total));
        $num.text(i + 1);
    });
    $('#cp-btn-add').prop('disabled', total >= 10);
    rebuildWinnerButtons();
}

function addOutcomeRow(title, pts, users) {
    const rows = getOutcomeRows();
    if (rows.length >= 10) return;
    const row = $(`
      <div class="out-row">
        <span class="out-num"></span>
        <input type="text"   class="out-title" placeholder="Title" value="${title || ''}">
        <input type="number" class="out-pts"   placeholder="Pts"   value="${pts != null ? pts : 0}"   min="0">
        <input type="number" class="out-users" placeholder="Users" value="${users != null ? users : 0}" min="0">
        <button type="button" class="out-del" title="Remove">×</button>
      </div>
    `);
    row.find('.out-del').click(function () {
        if (getOutcomeRows().length <= 2) return;
        $(this).closest('.out-row').remove();
        refreshOutcomeNumbers();
        sendCurrentPreview();
    });
    row.find('.out-title').on('input', () => { rebuildWinnerButtons(); sendCurrentPreview(); });
    row.find('.out-pts, .out-users').on('input', () => sendCurrentPreview());
    $('#cp-outcomes-form').append(row);
    refreshOutcomeNumbers();
}

function setupSections() {
    $('.sec-head').click(function () {
        const $head = $(this);
        const sec = $head.data('sec');
        const $body = $('#sec-' + sec);
        $head.toggleClass('collapsed');
        $body.toggleClass('collapsed');
    });
}

function setupAnchorGrid() {
    $('#posGrid .pos-cell').click(function () {
        $('#posGrid .pos-cell').removeClass('on');
        $(this).addClass('on');
        selectedPos = $(this).data('pos');
        applyAnchor();
    });
}

function applyAnchor() {
    const panelW = parseInt($('#panelW').val()) || 480;
    const panelH = Math.round(panelW * (FRAME_H / FRAME_W));
    const margin = 60;
    let x = 60, y = 60;

    if (selectedPos.includes('top'))    y = margin;
    if (selectedPos.includes('middle')) y = (1080 - panelH) / 2;
    if (selectedPos.includes('bottom')) y = 1080 - panelH - margin;
    if (selectedPos.includes('center') && !selectedPos.includes('top') && !selectedPos.includes('bottom')) {
        y = (1080 - panelH) / 2;
    }
    if (selectedPos.includes('left'))   x = margin;
    if (selectedPos.includes('right'))  x = 1920 - panelW - margin;
    if (selectedPos.includes('center')) x = (1920 - panelW) / 2;

    $('#panelX').val(Math.round(x));
    $('#panelY').val(Math.round(y));
    PANEL_DIMS.x = Math.round(x);
    PANEL_DIMS.y = Math.round(y);
    PANEL_DIMS.w = panelW;
    if (window.PredictionPanel) window.PredictionPanel.setCfg(PANEL_DIMS.x, PANEL_DIMS.y, PANEL_DIMS.w);
}

function applyManualPos() {
    PANEL_DIMS.x = parseInt($('#panelX').val()) || 60;
    PANEL_DIMS.y = parseInt($('#panelY').val()) || 60;
    PANEL_DIMS.w = parseInt($('#panelW').val()) || 480;
    if (window.PredictionPanel) window.PredictionPanel.setCfg(PANEL_DIMS.x, PANEL_DIMS.y, PANEL_DIMS.w);
}

function onBackendConnect(b) {
    backend = b;
    backend.subscribe('/topic/channelPredictionReceived', onLiveEvent);
}

function onLiveEvent(event) {
    const $state = $('#live-state');
    $state.removeClass('s-start s-progress s-locked s-end');
    const map = { START: 's-start', PROGRESS: 's-progress', LOCKED: 's-locked', END: 's-end' };
    $state.addClass(map[event.eventType] || '').text(event.eventType);
    $('#live-title').text(event.title || '');
}

function sendTest(eventType, winningOutcomeId) {
    const payload = buildMockEvent(eventType, winningOutcomeId);
    if (window.PredictionPanel) {
        switch (eventType) {
            case 'START':    window.PredictionPanel.onStart(payload);    break;
            case 'PROGRESS': window.PredictionPanel.onProgress(payload); break;
            case 'LOCKED':   window.PredictionPanel.onLocked(payload);   break;
            case 'END':      window.PredictionPanel.onEnd(payload);      break;
        }
    }
    if (backend) {
        backend.sendObject('/app/object', { cmd: 'testPrediction', payload });
    }
}

function buildMockEvent(eventType, winningOutcomeId) {
    const now   = new Date().toISOString();
    const locks = new Date(Date.now() + 120000).toISOString();
    const rows  = getOutcomeRows();
    const outcomes = rows.map((i, row) => {
        const $r = $(row);
        return {
            id:    mockOutcomeIds[i] || `mock-${i}`,
            title: $r.find('.out-title').val() || `Outcome ${i + 1}`,
            color: i === 0 ? 'BLUE' : (i === 1 ? 'PINK' : 'BLUE'),
            channelPointsSpent: parseInt($r.find('.out-pts').val())   || 0,
            numberOfUsers:      parseInt($r.find('.out-users').val()) || 0,
            topPredictors:      []
        };
    }).get();
    return {
        eventType,
        id:    mockId,
        title: $('#cp-title').val(),
        outcomes,
        startedAt:        now,
        locksAt:          eventType === 'END' ? null : locks,
        endedAt:          eventType === 'END' ? now  : null,
        winningOutcomeId: winningOutcomeId || null
    };
}

function sendCurrentPreview() {
    if (!mockId || workflowStep === 0 || workflowStep >= 4) return;
    sendTest('PROGRESS');
}

function fireStart() {
    mockId = crypto.randomUUID();
    const rows = getOutcomeRows();
    mockOutcomeIds = [];
    rows.each(() => mockOutcomeIds.push(crypto.randomUUID()));
    rebuildWinnerButtons();
    sendTest('START');
    setWorkflowStep(1);
}

function fireProgress() {
    if (!mockId) return fireStart();
    sendTest('PROGRESS');
    setWorkflowStep(2);
}

function fireLocked() {
    if (!mockId) return;
    sendTest('LOCKED');
    setWorkflowStep(3);
}

function fireEndForIndex(i) {
    if (!mockOutcomeIds[i]) return;
    sendTest('END', mockOutcomeIds[i]);
    setWorkflowStep(4);
}

function fireCancel() {
    if (!mockId) return;
    sendTest('END', null);
    setWorkflowStep(4);
}

function fireHide() {
    if (window.PredictionPanel) window.PredictionPanel.hide();
    if (backend) backend.sendObject('/app/object', { cmd: 'hidePrediction' });
    setWorkflowStep(0);
    mockId = null;
}

function fireFullTest() {
    fireStart();
    setTimeout(() => {
        const rows = getOutcomeRows();
        rows.each((i, row) => {
            const cur = parseInt($(row).find('.out-pts').val()) || 0;
            $(row).find('.out-pts').val(cur + Math.floor(Math.random() * 5000) + 1000);
        });
        fireProgress();
    }, 1800);
    setTimeout(() => fireLocked(), 4200);
    setTimeout(() => fireEndForIndex(0), 6500);
}

$(() => {
    backend = new Backend(onBackendConnect);

    setupSections();
    setupAnchorGrid();

    $('#apStart').click(fireStart);
    $('#apProgress').click(fireProgress);
    $('#apLocked').click(fireLocked);
    $('#apResolve').click(() => { if (workflowStep < 3) return; });
    $('#apCancel').click(fireCancel);
    $('#apHide').click(fireHide);
    $('#apTest').click(fireFullTest);

    $('#cp-btn-add').click(() => { addOutcomeRow(); sendCurrentPreview(); });
    $('#cp-title').on('input', () => sendCurrentPreview());

    $('#panelX, #panelY, #panelW').on('input', () => { applyManualPos(); });
    $('#resetPos').click(() => { $('#panelX').val(60); $('#panelY').val(60); applyManualPos(); });
    $('#resetSize').click(() => { $('#panelW').val(480); applyManualPos(); });

    $('#barEasing').on('input', function () {
        const v = parseInt(this.value);
        $('#barEasingVal').text((v / 100).toFixed(2));
        if (window.PredictionPanel) window.PredictionPanel.configure({ barEasing: v / 100 });
    });
    $('#maxOpts').on('input', function () {
        $('#maxOptsVal').text(this.value);
        if (window.PredictionPanel) window.PredictionPanel.configure({ maxOutcomes: parseInt(this.value) });
    });
    $('#resultRevealMs').on('input', function () {
        if (window.PredictionPanel) window.PredictionPanel.configure({ resultRevealMs: parseInt(this.value) || 2800 });
    });
    $('#lingerMs').on('input', function () {
        if (window.PredictionPanel) window.PredictionPanel.configure({ lingerMs: parseInt(this.value) || 7000 });
    });

    addOutcomeRow('Yes', 12500, 47);
    addOutcomeRow('No',  8200,  31);

    setWorkflowStep(0);
    setTimeout(applyManualPos, 100);
});
