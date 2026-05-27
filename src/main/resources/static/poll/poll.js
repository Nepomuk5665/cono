let cfg = { panelX:40, panelY:40, panelW:480 };
let lastPollEvent = null;
let chickenVisible = localStorage.getItem('chickenVisible') !== 'false';

function buildChickenData(event, type){
    const ch = (event.pollChoices||[]).map(function(c){
        return {title:c.title, votes:(c.totalVotes||0)+(c.channelPointVotes||0)};
    });
    const tot = ch.reduce(function(s,c){ return s+c.votes; }, 0);
    let winnerIdx = -1;
    if(type==='END' && event.status!=='archived' && tot>0)
        winnerIdx = ch.reduce(function(b,c,i){ return c.votes>ch[b].votes?i:b; }, 0);
    return {title:event.title||'', isEnd:type==='END',
            isCancelled:type==='END'&&event.status==='archived',
            endsAt:event.endsAt||null, winnerIdx, choices:ch};
}

function applyPollEvent(event){
    if(event.eventType==='START'){
        lastPollEvent = event;
        const d = buildChickenData(event,'START');
        function startPanel(){
            var pollDuration = (event.endsAt && event.startedAt)
                ? (new Date(event.endsAt).getTime() - new Date(event.startedAt).getTime())
                : 120000;
            var adjustedD = Object.assign({}, d, { endsAt: new Date(Date.now() + pollDuration).toISOString(), displayDuration: pollDuration });
            if(window.PollPanel) window.PollPanel.onPollStart(adjustedD);
        }
        if(!event._restore && window.ChickenAnim && chickenVisible) window.ChickenAnim.onPollStart(startPanel);
        else startPanel();
    } else if(event.eventType==='PROGRESS'){
        lastPollEvent = event;
        const d = buildChickenData(event,'PROGRESS');
        if(window.PollPanel) window.PollPanel.updatePollData(d);
    } else if(event.eventType==='END'){
        const cd = buildChickenData(event,'END');
        if(event.status==='archived'){
            if(window.ChickenAnim) window.ChickenAnim.onPollCancel();
            if(window.PollPanel)   window.PollPanel.onPollCancel(cd);
        } else {
            if(window.ChickenAnim) window.ChickenAnim.onPollEnd();
            if(window.PollPanel)   window.PollPanel.onPollEnd(cd);
        }
    }
}

function onCommandReceived(cmd){
    if(cmd.cmd==='pollConfig'){
        Object.assign(cfg, cmd);
        if(cmd.panelX!==undefined||cmd.panelY!==undefined||cmd.panelW!==undefined){
            if(window.ChickenAnim) window.ChickenAnim.setCfg(cfg.panelX, cfg.panelY, cfg.panelW);
            if(window.PollPanel)   window.PollPanel.setCfg(cfg.panelX, cfg.panelY, cfg.panelW);
        }
    } else if(cmd.cmd==='pollTest'){
        applyPollEvent(cmd.event);
    } else if(cmd.cmd==='pollPause'){
        if(window.ChickenAnim) window.ChickenAnim.onPollPause();
        if(window.PollPanel)   window.PollPanel.onPollPause();
    } else if(cmd.cmd==='pollResume'){
        if(window.ChickenAnim) window.ChickenAnim.onPollResume();
        if(window.PollPanel)   window.PollPanel.onPollResume();
    } else if(cmd.cmd==='pollReveal'){
        if(window.ChickenAnim) window.ChickenAnim.onPollEnd();
        if(window.PollPanel)   window.PollPanel.onPollEnd(lastPollEvent ? buildChickenData(lastPollEvent,'END') : { title:'', choices:[], isEnd:true, isCancelled:false, winnerIdx:-1, endsAt:null });
    } else if(cmd.cmd==='pollHide'){
        if(window.ChickenAnim) window.ChickenAnim.onPollCancel();
        if(window.PollPanel)   window.PollPanel.hide();
    } else if(cmd.cmd==='chickenVisible'){
        chickenVisible = !!cmd.visible;
        localStorage.setItem('chickenVisible', chickenVisible);
        if(window.ChickenAnim) window.ChickenAnim.setVisible(chickenVisible);
    } else if(cmd.cmd==='chickenCfg'){
        if(cmd.entryDir             && window.chickenCfg) window.chickenCfg.entryDir=cmd.entryDir;
        if(cmd.rotation!==undefined            && window.chickenCfg) window.chickenCfg.rotation=cmd.rotation;
        if(cmd.rotationX!==undefined           && window.chickenCfg) window.chickenCfg.rotationX=cmd.rotationX;
        if(cmd.celebrationSequence !== undefined && window.chickenCfg) window.chickenCfg.celebrationSequence=cmd.celebrationSequence;
    }
}

function onBackendConnect(b){
    b.subscribe('/topic/channelPollReceived', applyPollEvent);
    b.subscribe('/topic/object', onCommandReceived);
    if(window.ChickenAnim) window.ChickenAnim.setVisible(chickenVisible);
    else setTimeout(function(){ if(window.ChickenAnim) window.ChickenAnim.setVisible(chickenVisible); }, 1500);
}
