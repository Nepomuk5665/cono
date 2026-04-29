let cfg = {
    panelPosition:'top-left', panelX:40, panelY:40, panelW:480,
    accentColor:'#e8a030', winnerColor:'#ffe88a', barColorA:'#c06010', barColorB:'#f0c040', bgColor:'#080604', bgOpacity:0.82,
    showFooter:true,
    fontFamily:'"Segoe UI",system-ui,Arial,sans-serif',
    fontSize:16,
    cornerRadius:10,
    displayMode:'bar',
};

function fz(n){ return Math.round(n * (cfg.fontSize||16) / 16); }

let poll=null, choices=[], phase='hidden', phaseTs=0, scanOff=0;
const FADE_MS=500;
let resultMs=9000;

let prevVotes=[];
const canvas=document.getElementById('pollCanvas');
const ctx=canvas.getContext('2d');
canvas.width=1920; canvas.height=1080;

function h2r(hex){
    return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)};
}
function rgba(hex,a){
    const c=h2r(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function autoText(opacity){
    const t=Math.max(0,Math.min(1,opacity));
    if(t>=0.5){const v=Math.min(255,Math.round(160+t*95));return `rgb(${v},${v},${Math.min(255,v+8)})`;}
    const v=Math.round(15+t*70);return `rgb(${v},${v},${v+15})`;
}
function autoTextMid(opacity){
    const t=Math.max(0,Math.min(1,opacity));
    if(t>=0.5){const v=Math.min(255,Math.round(100+t*80));return `rgb(${v},${v},${Math.min(255,v+20)})`;}
    const v=Math.round(40+t*60);return `rgb(${v},${v},${v+20})`;
}

function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
}

function panelGeometry(){
    const PAD=20;
    const HDR_H=cfg.displayMode==='compact'?48:62;
    const ROW_H=cfg.displayMode==='compact'?44:56;
    const BAR_H=10;
    const FTR_H=cfg.showFooter?26:0;
    const W=cfg.panelW;
    const H=HDR_H+choices.length*ROW_H+FTR_H+10;
    const cx=(canvas.width-W)/2, cy=(canvas.height-H)/2;
    const rx=canvas.width-W-cfg.panelX, by=canvas.height-H-cfg.panelY;
    let x=cfg.panelX, y=cfg.panelY;
    switch(cfg.panelPosition){
        case'top-center':   x=cx;  y=cfg.panelY; break;
        case'top-right':    x=rx;  y=cfg.panelY; break;
        case'middle-left':  x=cfg.panelX; y=cy;  break;
        case'center':       x=cx;  y=cy;          break;
        case'middle-right': x=rx;  y=cy;          break;
        case'bottom-left':  x=cfg.panelX; y=by;  break;
        case'bottom-center':x=cx;  y=by;          break;
        case'bottom-right': x=rx;  y=by;          break;
    }
    return {x,y,W,H,PAD,HDR_H,ROW_H,BAR_H,FTR_H};
}

function drawPanelDefault(alpha,ts){
    if(!poll) return;
    const geo=panelGeometry();
    const {x,y,W,H,PAD,HDR_H,ROW_H,BAR_H}=geo;

    const isEnd=poll.eventType==='END';
    const isCancelled=isEnd&&poll.status==='archived';
    const totalReal=choices.reduce((s,c)=>s+c.votes,0);
    const totalAnim=choices.reduce((s,c)=>s+c.animVotes,0);
    const accent=isCancelled?'#a03820':cfg.accentColor;
    const RADIUS=cfg.cornerRadius??10;

    let winnerIdx=-1;
    if(isEnd&&!isCancelled&&totalReal>0)
        winnerIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;

    const bg=h2r(cfg.bgColor||'#080604');
    ctx.shadowColor='rgba(0,0,0,0.6)';
    ctx.shadowBlur=24;
    roundRect(x,y,W,H,RADIUS);
    ctx.fillStyle=`rgba(${bg.r},${bg.g},${bg.b},${cfg.bgOpacity})`;
    ctx.fill();
    ctx.shadowBlur=0;

    roundRect(x,y,W,H,RADIUS);
    ctx.strokeStyle=rgba(accent,0.2);
    ctx.lineWidth=1;
    ctx.stroke();

    const stripW=4;
    ctx.beginPath();
    ctx.moveTo(x+RADIUS,y); ctx.lineTo(x+stripW,y);
    ctx.arcTo(x,y,x,y+RADIUS,RADIUS); ctx.lineTo(x,y+H-RADIUS);
    ctx.arcTo(x,y+H,x+RADIUS,y+H,RADIUS); ctx.lineTo(x+stripW,y+H);
    ctx.lineTo(x+stripW,y);
    ctx.closePath();
    const sg=ctx.createLinearGradient(0,y,0,y+H);
    sg.addColorStop(0,rgba(accent,0.9));
    sg.addColorStop(1,rgba(accent,0.3));
    ctx.fillStyle=sg;
    ctx.shadowColor=accent; ctx.shadowBlur=8;
    ctx.fill();
    ctx.shadowBlur=0;

    const remaining=!isEnd&&poll.endsAt?Math.max(0,Math.ceil((new Date(poll.endsAt)-Date.now())/1000)):0;
    const urgent=!isEnd&&remaining<=10&&remaining>0;

    ctx.font=`600 ${fz(10)}px ${cfg.fontFamily}`;
    ctx.fillStyle=rgba(accent,0.7);
    ctx.textAlign='left';
    ctx.fillText(isCancelled?'CANCELLED':isEnd?'ENDED':'POLL',x+PAD+4,y+18);

    if(!isEnd&&poll.endsAt){
        const m=Math.floor(remaining/60),s=remaining%60;
        ctx.textAlign='right';
        if(urgent){
            const pulse=.6+.4*Math.abs(Math.sin(ts/120));
            ctx.fillStyle=`rgba(255,${Math.round(60+pulse*80)},20,${.7+pulse*.3})`;
            ctx.shadowColor='#ff4400'; ctx.shadowBlur=8+pulse*6;
        } else {
            ctx.fillStyle=rgba(accent,.45);
        }
        ctx.fillText(`${m}:${String(s).padStart(2,'0')}`,x+W-PAD,y+18);
        ctx.shadowBlur=0; ctx.textAlign='left';
    }

    const qFontSize=cfg.displayMode==='compact'?fz(15):fz(18);
    ctx.font=`700 ${qFontSize}px ${cfg.fontFamily}`;
    ctx.fillStyle=autoText(cfg.bgOpacity);
    ctx.textAlign='left';
    ctx.fillText(poll.title,x+PAD+4,y+HDR_H-18,W-PAD*2-8);

    ctx.fillStyle=rgba(accent,.12);
    ctx.fillRect(x+PAD,y+HDR_H,W-PAD*2,1);

    const isWinReveal = isEnd && !isCancelled && winnerIdx >= 0;

    choices.forEach((choice,i)=>{
        const ry=y+HDR_H+i*ROW_H;
        const barX=x+PAD+4;
        const barY=ry+ROW_H-BAR_H-10;
        const barW=W-PAD*2-8;
        const pct=totalAnim>0?choice.animVotes/totalAnim:0;
        const realPct=totalReal>0?Math.round(choice.votes/totalReal*100):0;
        const isWin=i===winnerIdx;

        const ghostRow = isWinReveal && !isWin;
        if(ghostRow){
            ctx.save();
            ctx.globalAlpha = alpha * 0.09;
            ctx.filter = 'blur(2px)';
        }

        const fSz=cfg.displayMode==='compact'?fz(12):fz(14);
        ctx.font=`${isWin?'600':'400'} ${fSz}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?cfg.winnerColor:autoTextMid(cfg.bgOpacity);
        ctx.textAlign='left';
        if(isWin){ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=6;}
        ctx.fillText(choice.title,barX,ry+fSz+10,barW-60);
        ctx.shadowBlur=0;

        ctx.font=`600 ${fz(10)}px ${cfg.fontFamily}`;
        ctx.textAlign='right';
        if(isWin){
            ctx.fillStyle=cfg.winnerColor; ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=6;
            ctx.fillText('★ WINNER',x+W-PAD,ry+fSz+10);
            ctx.shadowBlur=0;
        }
        ctx.textAlign='left';

        ctx.font=`700 ${fSz+1}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?cfg.winnerColor:rgba(accent,.8);
        ctx.textAlign='right';
        ctx.fillText(`${realPct}%`,x+W-PAD,barY-3);
        ctx.textAlign='left';

        roundRect(barX,barY,barW,BAR_H,BAR_H/2);
        ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fill();

        if(pct>0.002){
            const fillW=Math.max(BAR_H,barW*pct);
            const cA=h2r(cfg.barColorA||accent);
            const cB=h2r(cfg.barColorB||accent);
            const gr=ctx.createLinearGradient(barX,0,barX+fillW,0);
            gr.addColorStop(0,`rgba(${cA.r},${cA.g},${cA.b},${isWin?.95:.7})`);
            gr.addColorStop(1,`rgba(${cB.r},${cB.g},${cB.b},${isWin?1:.9})`);

            ctx.save();
            roundRect(barX,barY,barW,BAR_H,BAR_H/2);
            ctx.clip();
            if(isWin){ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=14;}
            ctx.globalAlpha=alpha;
            ctx.fillStyle=gr;
            ctx.fillRect(barX,barY,fillW,BAR_H);
            ctx.shadowBlur=0;

            const shimX=barX+(scanOff%(barW+80))-30;
            if(!isEnd&&shimX>barX&&shimX<barX+fillW){
                const sg2=ctx.createLinearGradient(shimX-20,0,shimX+20,0);
                sg2.addColorStop(0,'rgba(255,255,255,0)');
                sg2.addColorStop(.5,'rgba(255,255,255,0.3)');
                sg2.addColorStop(1,'rgba(255,255,255,0)');
                ctx.fillStyle=sg2;
                ctx.fillRect(Math.max(barX,shimX-20),barY,Math.min(40,fillW),BAR_H);
            }
            ctx.restore();
        }
        if(ghostRow){ ctx.filter='none'; ctx.restore(); }
    });

    if(isWinReveal){
        const winner=choices[winnerIdx];
        const ry=y+HDR_H+winnerIdx*ROW_H;
        const barX=x+PAD+4, barW=W-PAD*2-8;
        const pulse=0.55+0.45*Math.abs(Math.sin(ts/260));
        const wFz=fz(cfg.displayMode==='compact'?15:18);

        ctx.save();
        ctx.globalAlpha=alpha*0.14*pulse;
        roundRect(barX-4,ry+2,barW+8,ROW_H-4,6);
        ctx.fillStyle=cfg.winnerColor; ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.font=`900 ${fz(10)}px ${cfg.fontFamily}`;
        ctx.fillStyle=cfg.winnerColor;
        ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=18*pulse;
        ctx.textAlign='left';
        ctx.fillText('\u2736 WINNER \u2736',barX,ry+fz(11));
        ctx.shadowBlur=0;

        ctx.font=`900 ${wFz+6}px ${cfg.fontFamily}`;
        ctx.fillStyle='#ffffff';
        ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=14*pulse;
        ctx.fillText(winner.title,barX,ry+fz(11)+wFz+10,barW-70);
        ctx.shadowBlur=0;

        const winPct=totalReal>0?Math.round(winner.votes/totalReal*100):0;
        ctx.font=`700 ${fz(14)}px ${cfg.fontFamily}`;
        ctx.fillStyle=cfg.winnerColor;
        ctx.textAlign='right';
        ctx.fillText(`${winPct}%`,x+W-PAD,ry+fz(11)+wFz+10);
        ctx.restore();
    }

    if(cfg.showFooter){
        const ftrY=y+HDR_H+choices.length*ROW_H+4;
        ctx.font=`400 ${fz(10)}px ${cfg.fontFamily}`;
        ctx.fillStyle=rgba(accent,.25);
        ctx.textAlign='left';
        ctx.fillText(`${totalReal} votes`,x+PAD+4,ftrY+16);
        if(!isEnd&&poll.startedAt){
            const el=Math.floor((Date.now()-new Date(poll.startedAt))/1000);
            ctx.textAlign='right';
            ctx.fillText(`${Math.floor(el/60)}:${String(el%60).padStart(2,'0')}`,x+W-PAD,ftrY+16);
            ctx.textAlign='left';
        }
    }

    ctx.restore();
}

function render(ts){
    requestAnimationFrame(render);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(phase==='hidden') return;

    scanOff=(ts/4)%(cfg.panelW+80);

    const geo=panelGeometry();

    choices.forEach((c,i)=>{
        c.animVotes+=(c.votes-c.animVotes)*.06;
        prevVotes[i]=c.votes;
    });

    const elapsed=ts-phaseTs;
    let alpha=1;
    if(phase==='show'){
        alpha=Math.min(1,elapsed/FADE_MS);
        if(alpha>=1){phase='active';phaseTs=ts;}
    } else if(phase==='result'){
        if(elapsed>resultMs){phase='hide';phaseTs=ts;}
    } else if(phase==='hide'){
        alpha=Math.max(0,1-elapsed/FADE_MS);
        if(alpha<=0){phase='hidden';poll=null;choices=[];return;}
    }

    drawPanelDefault(alpha, ts);
}

function applyPollEvent(event){
    poll=event;
    (event.pollChoices||[]).forEach((c,i)=>{
        const votes=(c.totalVotes||0)+(c.channelPointVotes||0);
        if(choices[i]){
            choices[i].title=c.title; choices[i].votes=votes;
        } else {
            choices[i]={title:c.title,votes,animVotes:0};
            prevVotes[i]=votes;
        }
    });
    choices.length=(event.pollChoices||[]).length;
    if(event.eventType==='START'){
        phase='show'; phaseTs=performance.now();
        prevVotes=choices.map(c=>c.votes);
    } else if(event.eventType==='END'){
        phase='result'; phaseTs=performance.now();
    }
}

function onCommandReceived(cmd){
    if(cmd.cmd==='pollConfig'){
        Object.assign(cfg,cmd);
        if(cmd.resultMs) resultMs=cmd.resultMs;
    }
    if(cmd.cmd==='pollTest') applyPollEvent(cmd.event);
}

function onBackendConnect(b){
    b.subscribe('/topic/channelPollReceived',applyPollEvent);
    b.subscribe('/topic/object',onCommandReceived);
}

$(()=>{
    new Backend(onBackendConnect);
    requestAnimationFrame(render);
});
