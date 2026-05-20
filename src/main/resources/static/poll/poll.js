let cfg = { panelX:40, panelY:40, panelW:480, panelDelay:2500 };

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
        const d = buildChickenData(event,'START');
        if(window.ChickenAnim) window.ChickenAnim.onPollStart();
        setTimeout(function(){ if(window.PollPanel) window.PollPanel.onPollStart(d); }, cfg.panelDelay);
    } else if(event.eventType==='PROGRESS'){
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
    } else if(cmd.cmd==='pollShow'){
        if(window.ChickenAnim) window.ChickenAnim.onPollStart();
    } else if(cmd.cmd==='pollReveal'){
        if(window.ChickenAnim) window.ChickenAnim.onPollEnd();
        if(window.PollPanel)   window.PollPanel.onPollEnd({ title:'', choices:[], isEnd:true, isCancelled:false, winnerIdx:-1, endsAt:null });
    } else if(cmd.cmd==='pollHide'){
        if(window.ChickenAnim) window.ChickenAnim.onPollCancel();
        if(window.PollPanel)   window.PollPanel.hide();
    } else if(cmd.cmd==='chickenCfg'){
        if(cmd.size!==undefined     && window.chickenCfg) window.chickenCfg.size=cmd.size;
        if(cmd.exitDir              && window.chickenCfg) window.chickenCfg.exitDir=cmd.exitDir;
        if(cmd.entryDir             && window.chickenCfg) window.chickenCfg.entryDir=cmd.entryDir;
        if(cmd.rotation!==undefined            && window.chickenCfg) window.chickenCfg.rotation=cmd.rotation;
        if(cmd.rotationX!==undefined           && window.chickenCfg) window.chickenCfg.rotationX=cmd.rotationX;
        if(cmd.celebrationSequence !== undefined && window.chickenCfg) window.chickenCfg.celebrationSequence=cmd.celebrationSequence;
    }
}

function onBackendConnect(b){
    b.subscribe('/topic/channelPollReceived', applyPollEvent);
    b.subscribe('/topic/object', onCommandReceived);
}
