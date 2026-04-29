let backend = null;

const MOCK_POLL = {
    id:'test-1', title:'Which ship should we fly next?',
    pollChoices:[
        {id:'a',title:'Apocalypse',totalVotes:0,channelPointVotes:0},
        {id:'b',title:'Raven',     totalVotes:0,channelPointVotes:0},
        {id:'c',title:'Nyx',       totalVotes:0,channelPointVotes:0},
    ],
    startedAt:new Date().toISOString(),
    endsAt:new Date(Date.now()+120000).toISOString(),
    status:'active',
};

let selectedPos='top-left', selectedMode='bar';
let selectedCornerRadius=10, selectedFontFamily='"Segoe UI",system-ui,Arial,sans-serif', selectedFontSize=16;
let selectedOverlayStyle='default';
let debounceTimer=null;

function buildConfig(){
    return {
        cmd:             'pollConfig',
        accentColor:     $('#accentColor').val(),
        winnerColor:     $('#winnerColor').val(),
        timerColor:      $('#timerColor').val(),
        barColorA:       $('#barColorA').val(),
        barColorB:       $('#barColorB').val(),
        bgColor:         $('#bgColor').val(),
        bgOpacity:       parseInt($('#bgOpacity').val())/100,
        panelW:          parseInt($('#panelW').val()),
        panelPosition:   selectedPos,
        panelX:          parseInt($('#panelX').val()),
        panelY:          parseInt($('#panelY').val()),
        displayMode:     selectedMode,
        cornerRadius:    selectedCornerRadius,
        fontFamily:      $('#fontFamily').val().trim()||selectedFontFamily,
        fontSize:        selectedFontSize,
        overlayStyle:    selectedOverlayStyle,
    };
}

const _SAVE_KEY='pollCP_v1';

function saveState(){
    localStorage.setItem(_SAVE_KEY, JSON.stringify({
        accentColor:$('#accentColor').val(), winnerColor:$('#winnerColor').val(),
        timerColor:$('#timerColor').val(), barColorA:$('#barColorA').val(),
        barColorB:$('#barColorB').val(), bgColor:$('#bgColor').val(),
        bgOpacity:$('#bgOpacity').val(),
        panelW:$('#panelW').val(), panelX:$('#panelX').val(), panelY:$('#panelY').val(),
        selectedPos, selectedMode, selectedCornerRadius, selectedFontFamily, selectedFontSize, selectedOverlayStyle,
    }));
}

function restoreState(){
    const raw=localStorage.getItem(_SAVE_KEY); if(!raw) return;
    try{
        const d=JSON.parse(raw);
        if(d.accentColor) $('#accentColor').val(d.accentColor);
        if(d.winnerColor) $('#winnerColor').val(d.winnerColor);
        if(d.timerColor)  $('#timerColor').val(d.timerColor);
        if(d.barColorA)   $('#barColorA').val(d.barColorA);
        if(d.barColorB)   $('#barColorB').val(d.barColorB);
        if(d.bgColor)     $('#bgColor').val(d.bgColor);
        if(d.bgOpacity!==undefined){ $('#bgOpacity').val(d.bgOpacity); $('#bgOpacityVal').text(d.bgOpacity+'%'); }
        if(d.panelW!==undefined) $('#panelW').val(d.panelW);
        if(d.panelX!==undefined) $('#panelX').val(d.panelX);
        if(d.panelY!==undefined) $('#panelY').val(d.panelY);
        if(d.selectedPos){ selectedPos=d.selectedPos; $('#posGrid .pos-cell').removeClass('on'); $(`[data-pos="${d.selectedPos}"]`).addClass('on'); }
        if(d.selectedMode){ selectedMode=d.selectedMode; $('[data-mode]').removeClass('on'); $(`[data-mode="${d.selectedMode}"]`).addClass('on'); }
        if(d.selectedCornerRadius!==undefined) selectedCornerRadius=d.selectedCornerRadius;
        if(d.selectedFontFamily){ selectedFontFamily=d.selectedFontFamily; $('#fontFamily').val(d.selectedFontFamily); }
        if(d.selectedFontSize!==undefined){ selectedFontSize=d.selectedFontSize; $('#fontSize').val(d.selectedFontSize); $('#fontSizeVal').text(d.selectedFontSize+'px'); }
        if(d.selectedOverlayStyle!==undefined) selectedOverlayStyle=d.selectedOverlayStyle;
    }catch(e){}
}

function send(obj){
    if(typeof onCommandReceived === 'function') onCommandReceived(obj);
    if(backend) backend.sendObject('/app/object', obj);
}
function autoSend(){ saveState(); send(buildConfig()); }
function autoSendDebounced(ms=350){ clearTimeout(debounceTimer); debounceTimer=setTimeout(autoSend,ms); }

function sendTestEvent(type, votes){
    const ev=JSON.parse(JSON.stringify(MOCK_POLL));
    ev.eventType=type; ev.endsAt=new Date(Date.now()+120000).toISOString(); ev.startedAt=new Date().toISOString();
    if(votes){ev.pollChoices[0].totalVotes=votes[0];ev.pollChoices[1].totalVotes=votes[1];ev.pollChoices[2].totalVotes=votes[2];}
    send({cmd:'pollTest',event:ev});
}

$(() => {
    restoreState();

    $('#bgOpacity').on('input', ()=>{ $('#bgOpacityVal').text($('#bgOpacity').val()+'%'); autoSend(); });
    $('#fontSize').on('input', ()=>{ selectedFontSize=parseInt($('#fontSize').val()); $('#fontSizeVal').text(selectedFontSize+'px'); autoSend(); });
    $('#fontFamily').on('input', ()=>{ selectedFontFamily=$('#fontFamily').val().trim()||'"Segoe UI",system-ui,Arial,sans-serif'; autoSend(); });
    $('input[type=color]').on('input', autoSend);
    $('input[type=checkbox]').on('change', autoSend);
    $('input[type=number]').on('input', ()=>autoSendDebounced(300));

    $('#posGrid .pos-cell').click(function(){
        $('#posGrid .pos-cell').removeClass('on'); $(this).addClass('on');
        selectedPos=$(this).data('pos'); autoSend();
    });

    (function(){
        const bgColors={dark:'#111111',light:'#e8e8e8'};
        function applyBg(name){
            $('[data-bg]').removeClass('on');
            $(`[data-bg="${name}"]`).addClass('on');
            document.getElementById('preview-area').style.background=bgColors[name]||bgColors.dark;
            localStorage.setItem('pollBgIdx',name==='light'?2:1);
        }
        $('[data-bg]').click(function(){ applyBg($(this).data('bg')); });
        applyBg('dark');
    })();

    $('#chickenSize').on('input',function(){
        const v=parseInt($(this).val());
        $('#chickenSizeVal').text(v);
        if(typeof chickenCfg!=='undefined') chickenCfg.size=v;
    });
    $('[data-dance]').click(function(){
        $('[data-dance]').removeClass('on'); $(this).addClass('on');
        if(typeof chickenCfg!=='undefined') chickenCfg.danceType=$(this).data('dance');
    });
    $('[data-exit]').click(function(){
        $('[data-exit]').removeClass('on'); $(this).addClass('on');
        if(typeof chickenCfg!=='undefined') chickenCfg.exitDir=$(this).data('exit');
    });

    function setActiveBtn(id){ $('.t-btn').removeClass('active'); $('#'+id).addClass('active'); }

    $('#testStart').click(()=>{ autoSend(); sendTestEvent('START',[0,0,0]); setActiveBtn('testStart'); });
    $('#testFreeze').click(()=>{ if(typeof ChickenAnim!=='undefined') ChickenAnim.onPollPause(); setActiveBtn('testFreeze'); });
    $('#testProgress').click(()=>{ autoSend(); sendTestEvent('PROGRESS',[124,56,20]); if(typeof ChickenAnim!=='undefined') ChickenAnim.onPollResume(); setActiveBtn('testProgress'); });
    $('#testEnd').click(()=>{
        autoSend();
        const ev=JSON.parse(JSON.stringify(MOCK_POLL));
        ev.eventType='END'; ev.status='completed';
        ev.pollChoices[0].totalVotes=124; ev.pollChoices[1].totalVotes=56; ev.pollChoices[2].totalVotes=20;
        send({cmd:'pollTest',event:ev}); setActiveBtn('testEnd');
    });
    $('#testCancel').click(()=>{
        autoSend();
        const ev=JSON.parse(JSON.stringify(MOCK_POLL));
        ev.eventType='END'; ev.status='archived';
        send({cmd:'pollTest',event:ev}); setActiveBtn('testCancel');
    });

    autoSend();
    sendTestEvent('START',[124,56,20]);
    setActiveBtn('testStart');

    backend=new Backend(()=>{ $('#conn-dot').addClass('on').attr('title','Connected'); });
});
