let cfg = {
    panelPosition:'top-left', panelX:40, panelY:40, panelW:480,
    accentColor:'#e8a030', winnerColor:'#ffe88a', timerColor:'#e8a030', barColorA:'#c06010', barColorB:'#f0c040', bgColor:'#080604', bgOpacity:0.82,
    showFooter:true, resultMs:9000,
    fontFamily:'"Segoe UI",system-ui,Arial,sans-serif',
    fontSize:16,
    cornerRadius:10,
    frameImageUrl:'', framePad:20, frameOnly:false,
    leaderGlow:true,
    scorePop:true, celebrationEnabled:true,
    displayMode:'bar',
    overlayStyle:'default',
};

function fz(n){ return Math.round(n * (cfg.fontSize||16) / 16); }

let poll=null, choices=[], phase='hidden', phaseTs=0, scanOff=0;
const FADE_MS=500;
let resultMs=9000;

let scorePopPool=[];
let prevVotes=[];
let frameImg=null, frameImgLoaded='';
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

function _rrPath(px,py,pw,ph,pr){
    ctx.moveTo(px+pr,py);
    ctx.lineTo(px+pw-pr,py); ctx.arcTo(px+pw,py,px+pw,py+pr,pr);
    ctx.lineTo(px+pw,py+ph-pr); ctx.arcTo(px+pw,py+ph,px+pw-pr,py+ph,pr);
    ctx.lineTo(px+pr,py+ph); ctx.arcTo(px,py+ph,px,py+ph-pr,pr);
    ctx.lineTo(px,py+pr); ctx.arcTo(px,py,px+pr,py,pr);
    ctx.closePath();
}

function _wrapText(text,maxW){
    const words=text.split(' '), lines=[];
    let line='';
    words.forEach(w=>{
        const test=line?line+' '+w:w;
        if(ctx.measureText(test).width>maxW&&line){ lines.push(line); line=w; }
        else line=test;
    });
    if(line) lines.push(line);
    return lines;
}

function panelGeometry(){
    const PAD=20;
    const HDR_H=cfg.displayMode==='compact'?48:62;
    const ROW_H=cfg.displayMode==='compact'?44:cfg.displayMode==='hype'?72:56;
    const BAR_H=cfg.displayMode==='hype'?14:10;
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

function drawFrameImage(geo){
    if(!frameImg) return;
    const {x,y,W,H}=geo;
    const p=cfg.framePad||20;
    ctx.drawImage(frameImg,x-p,y-p,W+p*2,H+p*2);
}

function updateScorePops(){
    for(let i=scorePopPool.length-1;i>=0;i--){
        const p=scorePopPool[i];
        p.y-=.9; p.life-=.018;
        if(p.life<=0) scorePopPool.splice(i,1);
    }
}

function drawScorePops(){
    scorePopPool.forEach(p=>{
        ctx.save();
        ctx.globalAlpha=p.life;
        ctx.font=`bold ${fz(16)}px ${cfg.fontFamily}`;
        ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10;
        ctx.textAlign='right';
        ctx.fillText(`+${p.delta}`,p.x,p.y);
        ctx.restore();
    });
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
    let leaderIdx=-1;
    if(!isEnd&&totalReal>0)
        leaderIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;

    if(!cfg.frameOnly){
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
    }

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
        const isLead=cfg.leaderGlow&&i===leaderIdx&&!isEnd&&totalReal>0;
        const color=isWin?cfg.winnerColor:accent;

        const ghostRow = isWinReveal && !isWin;
        if(ghostRow){
            ctx.save();
            ctx.globalAlpha = alpha * 0.09;
            ctx.filter = 'blur(2px)';
        }

        if(isLead){
            const pulse=.15+.1*Math.sin(ts/380);
            ctx.strokeStyle=rgba(accent,pulse);
            ctx.lineWidth=1;
            ctx.shadowColor=accent; ctx.shadowBlur=10+5*Math.sin(ts/300);
            roundRect(barX-6,ry+4,barW+12,ROW_H-8,6);
            ctx.stroke(); ctx.shadowBlur=0;
        }

        const fSz=cfg.displayMode==='compact'?fz(12):fz(14);
        ctx.font=`${isWin||isLead?'600':'400'} ${fSz}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?cfg.winnerColor:isLead?autoText(cfg.bgOpacity):autoTextMid(cfg.bgOpacity);
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
        } else if(isLead){
            ctx.fillStyle=rgba(accent,.7);
            ctx.fillText('▲ LEADING',x+W-PAD,ry+fSz+10);
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
            const pulseScale=choice.pulsing?(0.7+0.3*choice.pulseLife):1;
            const cA=h2r(cfg.barColorA||accent);
            const cB=h2r(cfg.barColorB||accent);
            const gr=ctx.createLinearGradient(barX,0,barX+fillW,0);
            gr.addColorStop(0,`rgba(${cA.r},${cA.g},${cA.b},${isWin?.95:.7})`);
            gr.addColorStop(1,`rgba(${cB.r},${cB.g},${cB.b},${isWin?1:.9})`);

            ctx.save();
            roundRect(barX,barY,barW,BAR_H,BAR_H/2);
            ctx.clip();
            if(isWin||isLead){ctx.shadowColor=color; ctx.shadowBlur=isWin?14:7;}
            ctx.globalAlpha=alpha*pulseScale;
            ctx.fillStyle=gr;
            ctx.fillRect(barX,barY,fillW,BAR_H);
            ctx.shadowBlur=0;
            ctx.globalAlpha=alpha;

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

const INK_PTS=[
    [-0.44,-0.98],[-0.10,-1.06],[ 0.18,-0.94],[ 0.50,-0.80],
    [ 0.78,-0.54],[ 1.00,-0.12],[ 1.06, 0.26],[ 0.90, 0.60],
    [ 0.64, 0.86],[ 0.26, 1.00],[-0.12, 0.98],[-0.44, 0.86],
    [-0.74, 0.62],[-0.96, 0.30],[-1.06,-0.08],[-0.92,-0.48],
    [-0.68,-0.78],
];

const INK_DRIPS=[
    [ 0.22, 0.92, 0.24, 7],
    [-0.06, 0.97, 0.18, 5],
    [ 0.50, 0.82, 0.20, 6],
    [-0.30, 0.88, 0.14, 4],
    [ 0.64, 0.72, 0.12, 4],
];

const INK_DROPS=[
    [ 0.88,-0.70,14, 9,-0.3],[-0.76,-0.74,11, 7, 0.4],
    [ 1.04, 0.20,10, 6, 0.2],[-1.02, 0.24, 9, 6,-0.4],
    [ 0.36, 1.00,12, 8, 0.1],[-0.28,-0.94, 8, 5, 0.5],
    [ 0.72, 0.86, 6, 4, 0.8],[-0.60, 0.86, 5, 3,-0.7],
    [ 1.06,-0.32, 7, 4, 0.3],[-0.90, 0.56, 6, 4,-0.2],
    [ 0.12,-1.04, 8, 5, 0.6],[ 1.00, 0.50, 5, 3, 0.1],
];

function _inkPath(pts,cx,cy,rx,ry,sx,sy,ox,oy){
    const n=pts.length;
    const tx=p=>cx+ox+p[0]*rx*sx, ty=p=>cy+oy+p[1]*ry*sy;
    ctx.beginPath();
    for(let i=0;i<n;i++){
        const p0=pts[(i-1+n)%n],p1=pts[i],
              p2=pts[(i+1)%n],  p3=pts[(i+2)%n];
        const cp1x=tx(p1)+(tx(p2)-tx(p0))/6,cp1y=ty(p1)+(ty(p2)-ty(p0))/6;
        const cp2x=tx(p2)-(tx(p3)-tx(p1))/6,cp2y=ty(p2)-(ty(p3)-ty(p1))/6;
        if(i===0) ctx.moveTo(tx(p1),ty(p1));
        ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,tx(p2),ty(p2));
    }
    ctx.closePath();
}

function _brushStroke(x1,y1,x2,y2,wBase,wTip){
    const dx=x2-x1,dy=y2-y1;
    const len=Math.sqrt(dx*dx+dy*dy); if(len<1) return;
    const nx=-dy/len, ny=dx/len;
    ctx.beginPath();
    ctx.moveTo(x1+nx*wBase, y1+ny*wBase);
    ctx.quadraticCurveTo(
        (x1+x2)*0.5+nx*(wBase+wTip)*0.3, (y1+y2)*0.5+ny*(wBase+wTip)*0.3,
        x2+nx*wTip, y2+ny*wTip
    );
    ctx.lineTo(x2-nx*wTip, y2-ny*wTip);
    ctx.quadraticCurveTo(
        (x1+x2)*0.5-nx*(wBase+wTip)*0.3, (y1+y2)*0.5-ny*(wBase+wTip)*0.3,
        x1-nx*wBase, y1-ny*wBase
    );
    ctx.closePath();
    ctx.fill();
}

function drawPanelInk(alpha,ts){
    if(!poll) return;
    const geo=panelGeometry();
    const {x,y,W,H,PAD,HDR_H,ROW_H,FTR_H}=geo;
    const isEnd=poll.eventType==='END';
    const isCancelled=isEnd&&poll.status==='archived';
    const totalReal=choices.reduce((s,c)=>s+c.votes,0);
    const totalAnim=choices.reduce((s,c)=>s+c.animVotes,0);

    let winnerIdx=-1;
    if(isEnd&&!isCancelled&&totalReal>0)
        winnerIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;

    const _dbd_bg=h2r(cfg.bgColor||'#0a0000');
    ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=20;
    roundRect(x,y,W,H,3);
    ctx.fillStyle=`rgba(${_dbd_bg.r},${_dbd_bg.g},${_dbd_bg.b},${cfg.bgOpacity})`;
    ctx.fill(); ctx.shadowBlur=0;

    const titleFz=cfg.displayMode==='compact'?fz(17):fz(22);
    ctx.font=`700 ${titleFz}px ${cfg.fontFamily}`;
    ctx.fillStyle='#eae6de';
    ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=5;
    ctx.textAlign='left';
    ctx.fillText(poll.title,x+PAD+20,y+HDR_H-28,W-PAD*2-28);
    ctx.shadowBlur=0;

    const subText=isCancelled?'Poll cancelled'
        :isEnd?'Poll ended'
        :'Type number (1,2...) or text in chat to vote';
    ctx.font=`400 ${fz(12)}px ${cfg.fontFamily}`;
    ctx.fillStyle='rgba(160,152,140,0.85)';
    ctx.textAlign='left';
    ctx.fillText(subText,x+PAD+20,y+HDR_H-10,W-PAD*2-60);

    if(!isEnd&&poll.endsAt){
        const rem=Math.max(0,Math.ceil((new Date(poll.endsAt)-Date.now())/1000));
        const m=Math.floor(rem/60),s=rem%60,urgent=rem<=10&&rem>0;
        ctx.textAlign='right';
        ctx.font=`600 ${fz(11)}px ${cfg.fontFamily}`;
        if(urgent){
            const p=0.6+0.4*Math.abs(Math.sin(ts/120));
            ctx.fillStyle=`rgba(255,${Math.round(60+p*80)},20,${0.8+p*0.2})`;
            ctx.shadowColor='#ff4400'; ctx.shadowBlur=8+p*5;
        } else {
            ctx.fillStyle='rgba(155,160,170,0.60)';
        }
        ctx.fillText(`${m}:${String(s).padStart(2,'0')}`,x+W-PAD-20,y+HDR_H-10);
        ctx.shadowBlur=0; ctx.textAlign='left';
    }

    choices.forEach((choice,i)=>{
        const ry=y+HDR_H+i*ROW_H;
        const numX=x+PAD+20;
        const textX=x+PAD+48;
        const barX=textX;
        const barW=W-PAD*2-72;
        const textY=ry+Math.round(ROW_H*0.44);
        const barY=ry+Math.round(ROW_H*0.72);

        const realPct=totalReal>0?(choice.votes/totalReal*100).toFixed(1):'0.0';
        const animPct=totalAnim>0?choice.animVotes/totalAnim:0;
        const isWin=i===winnerIdx;
        const fSz=cfg.displayMode==='compact'?fz(15):fz(19);

        ctx.font=`400 ${fz(13)}px ${cfg.fontFamily}`;
        ctx.fillStyle='rgba(105,100,90,0.90)';
        ctx.textAlign='left';
        ctx.fillText(i+1,numX,textY);

        ctx.font=`${isWin?'700':'600'} ${fSz}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?'#f2ede4':'#cec9be';
        if(isWin){ctx.shadowColor='rgba(255,240,190,0.35)';ctx.shadowBlur=7;}
        ctx.textAlign='left';
        ctx.fillText(choice.title,textX,textY,barW-52);
        ctx.shadowBlur=0;

        ctx.font=`600 ${fSz-1}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?'#ede8de':'#9c9890';
        if(isWin){ctx.shadowColor='rgba(240,220,150,0.25)';ctx.shadowBlur=4;}
        ctx.textAlign='right';
        ctx.fillText(`${realPct}%`,x+W-PAD-20,textY);
        ctx.shadowBlur=0; ctx.textAlign='left';

        ctx.beginPath();
        ctx.moveTo(barX,barY); ctx.lineTo(barX+barW,barY);
        ctx.strokeStyle='rgba(255,255,255,0.06)';
        ctx.lineWidth=1.5; ctx.stroke();

        if(animPct>0.004){
            const fillW=Math.max(8,barW*animPct);
            ctx.beginPath();
            ctx.moveTo(barX,barY); ctx.lineTo(barX+fillW,barY);
            ctx.strokeStyle=isWin?'rgba(242,232,205,0.95)':'rgba(196,192,184,0.80)';
            ctx.lineWidth=1.5;
            if(isWin){ctx.shadowColor='rgba(240,220,160,0.45)';ctx.shadowBlur=6;}
            ctx.stroke(); ctx.shadowBlur=0;
        }
    });

    if(cfg.showFooter&&FTR_H>0){
        const ftrY=y+HDR_H+choices.length*ROW_H+Math.round(FTR_H*0.65);
        ctx.font=`400 ${fz(11)}px ${cfg.fontFamily}`;
        ctx.fillStyle='rgba(126,120,110,0.72)';
        ctx.textAlign='left';
        ctx.fillText(`Unique votes: ${totalReal}`,x+PAD+20,ftrY);
        if(!isEnd&&poll.startedAt){
            const el=Math.floor((Date.now()-new Date(poll.startedAt))/1000);
            const hh=Math.floor(el/3600),mm=Math.floor((el%3600)/60),ss=el%60;
            const ts2=hh>0?`${hh}h ${mm}m`:`${mm}m ${ss}s`;
            const rightEdge=x+W-PAD-20;
            ctx.textAlign='right';
            ctx.fillStyle='rgba(205,190,130,0.90)';
            ctx.fillText(ts2,rightEdge,ftrY);
            const valW=ctx.measureText(ts2).width;
            ctx.fillStyle='rgba(126,120,110,0.72)';
            ctx.fillText('Time active: ',rightEdge-valW,ftrY);
        } else if(isEnd){
            ctx.textAlign='right';
            ctx.fillText(isCancelled?'Cancelled':'Poll ended',x+W-PAD-20,ftrY);
        }
    }
    ctx.restore();
}

function drawPanelHud(alpha,ts){
    if(!poll) return;
    const geo=panelGeometry();
    const {x,y,W,H,PAD,HDR_H,ROW_H,BAR_H,FTR_H}=geo;
    const isEnd=poll.eventType==='END';
    const isCancelled=isEnd&&poll.status==='archived';
    const totalReal=choices.reduce((s,c)=>s+c.votes,0);
    const totalAnim=choices.reduce((s,c)=>s+c.animVotes,0);
    const accent=isCancelled?'#a03820':cfg.accentColor;

    let winnerIdx=-1;
    if(isEnd&&!isCancelled&&totalReal>0)
        winnerIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;

    const bg=h2r(cfg.bgColor||'#000810');
    ctx.fillStyle=`rgba(${bg.r},${bg.g},${bg.b},${cfg.bgOpacity})`;
    ctx.fillRect(x,y,W,H);

    for(let sy=y;sy<y+H;sy+=4){
        ctx.fillStyle='rgba(0,0,0,0.13)';
        ctx.fillRect(x,sy+2,W,2);
    }

    ctx.strokeStyle=rgba(accent,0.3); ctx.lineWidth=1;
    ctx.strokeRect(x+0.5,y+0.5,W-1,H-1);

    ctx.fillStyle=rgba(accent,0.8); ctx.fillRect(x,y,W,2);

    const BK=14;
    ctx.strokeStyle=rgba(accent,0.95); ctx.lineWidth=2;
    [[x,y,1,1],[x+W,y,-1,1],[x,y+H,1,-1],[x+W,y+H,-1,-1]].forEach(([bx,by,sx,sy])=>{
        ctx.beginPath();
        ctx.moveTo(bx+sx*BK,by); ctx.lineTo(bx,by); ctx.lineTo(bx,by+sy*BK);
        ctx.stroke();
    });

    ctx.font=`600 ${fz(9)}px ${cfg.fontFamily}`;
    ctx.fillStyle=rgba(accent,0.65); ctx.textAlign='left';
    ctx.fillText(isCancelled?'■ CANCELLED':isEnd?'■ ENDED':'▶ LIVE POLL',x+PAD,y+15);

    if(!isEnd&&poll.endsAt){
        const rem=Math.max(0,Math.ceil((new Date(poll.endsAt)-Date.now())/1000));
        const m=Math.floor(rem/60),s=rem%60,urgent=rem<=10&&rem>0;
        ctx.textAlign='right'; ctx.font=`600 ${fz(9)}px ${cfg.fontFamily}`;
        if(urgent){
            const p=0.6+0.4*Math.abs(Math.sin(ts/120));
            ctx.fillStyle=`rgba(255,${Math.round(60+p*80)},20,${0.7+p*0.3})`;
            ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
        } else { ctx.fillStyle=rgba(accent,0.55); }
        ctx.fillText(`T-${m}:${String(s).padStart(2,'0')}`,x+W-PAD,y+15);
        ctx.shadowBlur=0; ctx.textAlign='left';
    }

    ctx.fillStyle=rgba(accent,0.22); ctx.fillRect(x,y+20,W,1);
    const titleFz=cfg.displayMode==='compact'?fz(13):fz(16);
    ctx.font=`700 ${titleFz}px ${cfg.fontFamily}`;
    ctx.fillStyle=rgba(accent,0.92); ctx.textAlign='left';
    ctx.fillText(poll.title,x+PAD,y+HDR_H-12,W-PAD*2);
    ctx.fillStyle=rgba(accent,0.18); ctx.fillRect(x,y+HDR_H-2,W,1);

    choices.forEach((choice,i)=>{
        const ry=y+HDR_H+i*ROW_H;
        const barX=x+PAD, barW=W-PAD*2;
        const barY=ry+ROW_H-BAR_H-8;
        const realPct=totalReal>0?Math.round(choice.votes/totalReal*100):0;
        const animPct=totalAnim>0?choice.animVotes/totalAnim:0;
        const isWin=i===winnerIdx;
        const fSz=cfg.displayMode==='compact'?fz(11):fz(13);

        if(i>0){ ctx.fillStyle=rgba(accent,0.07); ctx.fillRect(x+PAD,ry,barW,1); }

        ctx.font=`${isWin?'700':'400'} ${fSz}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?cfg.winnerColor:rgba(accent,0.88);
        if(isWin){ctx.shadowColor=cfg.winnerColor;ctx.shadowBlur=8;}
        ctx.textAlign='left';
        ctx.fillText(choice.title,barX,ry+fSz+10,barW-70);
        ctx.shadowBlur=0;

        ctx.font=`700 ${fSz}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?cfg.winnerColor:rgba(accent,0.9);
        if(isWin){ctx.shadowColor=cfg.winnerColor;ctx.shadowBlur=6;}
        ctx.textAlign='right';
        ctx.fillText(`${realPct}%`,x+W-PAD,ry+fSz+10);
        ctx.shadowBlur=0; ctx.textAlign='left';

        if(isWin){
            ctx.font=`600 ${fz(9)}px ${cfg.fontFamily}`;
            ctx.fillStyle=cfg.winnerColor;
            ctx.shadowColor=cfg.winnerColor; ctx.shadowBlur=6;
            ctx.textAlign='right';
            ctx.fillText('◆ WINNER',x+W-PAD,barY-2);
            ctx.shadowBlur=0; ctx.textAlign='left';
        }

        ctx.fillStyle=rgba(accent,0.08); ctx.fillRect(barX,barY,barW,BAR_H);

        if(animPct>0.001){
            const fillW=Math.max(2,barW*animPct);
            const cA=h2r(cfg.barColorA||accent), cB=h2r(cfg.barColorB||accent);
            const gr=ctx.createLinearGradient(barX,0,barX+fillW,0);
            gr.addColorStop(0,`rgba(${cA.r},${cA.g},${cA.b},0.75)`);
            gr.addColorStop(1,`rgba(${cB.r},${cB.g},${cB.b},${isWin?1:0.92})`);
            if(isWin){ctx.shadowColor=cfg.winnerColor;ctx.shadowBlur=7;}
            ctx.fillStyle=gr; ctx.fillRect(barX,barY,fillW,BAR_H);
            ctx.shadowBlur=0;
            if(!isEnd){
                const shimX=barX+(scanOff%(barW+80))-30;
                if(shimX>barX&&shimX<barX+fillW){
                    const sg=ctx.createLinearGradient(shimX-20,0,shimX+20,0);
                    sg.addColorStop(0,'rgba(255,255,255,0)');
                    sg.addColorStop(0.5,'rgba(255,255,255,0.25)');
                    sg.addColorStop(1,'rgba(255,255,255,0)');
                    ctx.fillStyle=sg;
                    ctx.fillRect(Math.max(barX,shimX-20),barY,Math.min(40,fillW),BAR_H);
                }
            }
        }
    });

    if(cfg.showFooter){
        const ftrY=y+H-9;
        ctx.font=`400 ${fz(9)}px ${cfg.fontFamily}`;
        ctx.fillStyle=rgba(accent,0.22); ctx.textAlign='left';
        ctx.fillText(`VOTES: ${totalReal}`,x+PAD,ftrY);
        if(!isEnd&&poll.startedAt){
            const el=Math.floor((Date.now()-new Date(poll.startedAt))/1000);
            ctx.textAlign='right';
            ctx.fillText(`${Math.floor(el/60)}:${String(el%60).padStart(2,'0')}`,x+W-PAD,ftrY);
        }
    }
    ctx.restore();
}

function drawPanelCard(alpha,ts){
    if(!poll) return;
    const geo=panelGeometry();
    const {x,y,W}=geo;
    const isEnd=poll.eventType==='END';
    const isCancelled=isEnd&&poll.status==='archived';
    const totalReal=choices.reduce((s,c)=>s+c.votes,0);
    const totalAnim=choices.reduce((s,c)=>s+c.animVotes,0);

    const CP=18, R=12;
    const TITLE_FZ=fz(22), SUB_FZ=fz(12), NUM_FZ=fz(18), CHOICE_FZ=fz(15), BAR_THICK=2.5;
    const ROW=60, FTR=50;
    const maxTW=W-CP*2-8;

    ctx.font=`700 ${TITLE_FZ}px ${cfg.fontFamily}`;
    const titleLines=_wrapText(poll.title,maxTW);
    const titleH=titleLines.length*(TITLE_FZ+5);

    const subText=isCancelled?'Poll cancelled':isEnd?'Poll ended':'Type number (1,2...) or text in chat to vote';
    ctx.font=`400 ${SUB_FZ}px ${cfg.fontFamily}`;
    const subLines=_wrapText(subText,maxTW-20);
    const subH=subLines.length*(SUB_FZ+4);

    const HDR=CP+titleH+8+subH+12;
    const H=HDR+choices.length*ROW+FTR+CP;

    let winnerIdx=-1;
    if(isEnd&&!isCancelled&&totalReal>0)
        winnerIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;

    const FM=11;

    ctx.save();
    ctx.beginPath();
    _rrPath(x-FM,y-FM,W+FM*2,H+FM*2,R+FM+2);
    _rrPath(x-1,y-1,W+2,H+2,R+1);
    ctx.clip('evenodd');
    const fmg=ctx.createLinearGradient(x-FM,y-FM,x-FM,y+H+FM);
    fmg.addColorStop(0,   '#c8a84a');
    fmg.addColorStop(0.18,'#9a7c28');
    fmg.addColorStop(0.50,'#5e3e0a');
    fmg.addColorStop(0.82,'#9a7c28');
    fmg.addColorStop(1,   '#c4a244');
    ctx.fillStyle=fmg;
    ctx.fillRect(x-FM-2,y-FM-2,W+FM*2+4,H+FM*2+4);
    const fhl=ctx.createLinearGradient(x-FM,y-FM,x+W+FM,y-FM);
    fhl.addColorStop(0,'rgba(255,240,160,0.28)');
    fhl.addColorStop(0.5,'rgba(255,240,160,0.10)');
    fhl.addColorStop(1,'rgba(255,240,160,0.22)');
    ctx.fillStyle=fhl;
    ctx.fillRect(x-FM-2,y-FM-2,W+FM*2+4,H+FM*2+4);
    const fsh=ctx.createLinearGradient(x-FM,y-FM,x-FM,y+H+FM);
    fsh.addColorStop(0,'rgba(0,0,0,0.18)');
    fsh.addColorStop(0.5,'rgba(0,0,0,0.40)');
    fsh.addColorStop(1,'rgba(0,0,0,0.20)');
    ctx.fillStyle=fsh;
    ctx.fillRect(x-FM-2,y-FM-2,W+FM*2+4,H+FM*2+4);
    ctx.restore();

    ctx.beginPath(); _rrPath(x-FM,y-FM,W+FM*2,H+FM*2,R+FM+2);
    ctx.strokeStyle='rgba(30,18,4,0.90)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); _rrPath(x-FM+2,y-FM+2,W+FM*2-4,H+FM*2-4,R+FM);
    ctx.strokeStyle='rgba(255,220,100,0.18)'; ctx.lineWidth=1; ctx.stroke();

    roundRect(x,y,W,H,R);
    const pg=ctx.createRadialGradient(x+W*0.42,y+H*0.32,0,x+W*0.5,y+H*0.5,Math.max(W,H)*0.74);
    pg.addColorStop(0,'#d8c084'); pg.addColorStop(0.55,'#c6ac6a'); pg.addColorStop(1,'#b09050');
    ctx.fillStyle=pg; ctx.fill();

    roundRect(x,y,W,H,R);
    ctx.strokeStyle='#1c1408'; ctx.lineWidth=2.5; ctx.stroke();

    roundRect(x+4,y+4,W-8,H-8,R-2);
    ctx.strokeStyle='rgba(55,36,8,0.32)'; ctx.lineWidth=1; ctx.stroke();

    if(!isEnd&&poll.endsAt){
        const rem=Math.max(0,Math.ceil((new Date(poll.endsAt)-Date.now())/1000));
        const m=Math.floor(rem/60),s=rem%60,urgent=rem<=10&&rem>0;
        ctx.font=`600 ${fz(11)}px ${cfg.fontFamily}`;
        ctx.fillStyle=urgent?`rgba(160,20,0,${0.7+0.3*Math.abs(Math.sin(ts/120))})`:'rgba(50,34,8,0.55)';
        ctx.textAlign='right';
        ctx.fillText(`${m}:${String(s).padStart(2,'0')}`,x+W-CP-4,y+CP+12);
        ctx.textAlign='left';
    }

    ctx.font=`700 ${TITLE_FZ}px ${cfg.fontFamily}`;
    ctx.fillStyle='#1a1208'; ctx.textAlign='left';
    titleLines.forEach((ln,i)=>ctx.fillText(ln,x+CP+4,y+CP+TITLE_FZ+i*(TITLE_FZ+5)));

    ctx.font=`400 ${SUB_FZ}px ${cfg.fontFamily}`;
    ctx.fillStyle='#3a2a10'; ctx.textAlign='center';
    const subY0=y+CP+titleH+8+SUB_FZ;
    subLines.forEach((ln,i)=>ctx.fillText(ln,x+W/2,subY0+i*(SUB_FZ+4)));

    ctx.beginPath();
    ctx.moveTo(x+CP,y+HDR-5); ctx.lineTo(x+W-CP,y+HDR-5);
    ctx.strokeStyle='rgba(50,34,8,0.30)'; ctx.lineWidth=1; ctx.stroke();

    choices.forEach((choice,i)=>{
        const rowY=y+HDR+i*ROW;
        const textY=rowY+Math.round(ROW*0.46);
        const barY=rowY+Math.round(ROW*0.76);
        const barX=x+CP+30, barW=W-CP*2-30;
        const realPct=totalReal>0?(choice.votes/totalReal*100).toFixed(1):'0.0';
        const animPct=totalAnim>0?choice.animVotes/totalAnim:0;
        const isWin=i===winnerIdx;

        ctx.font=`700 ${NUM_FZ}px ${cfg.fontFamily}`;
        ctx.fillStyle='#1a1208'; ctx.textAlign='left';
        ctx.fillText(i+1,x+CP+3,textY);

        ctx.font=`${isWin?'700':'400'} ${CHOICE_FZ}px ${cfg.fontFamily}`;
        ctx.fillStyle='#1a1208'; ctx.textAlign='left';
        ctx.fillText(choice.title,barX,textY,barW-60);

        ctx.font=`600 ${CHOICE_FZ}px ${cfg.fontFamily}`;
        ctx.fillStyle='#3a2a10'; ctx.textAlign='right';
        ctx.fillText(`${realPct}%`,x+W-CP-4,textY);
        ctx.textAlign='left';

        ctx.beginPath();
        ctx.moveTo(barX,barY); ctx.lineTo(barX+barW-52,barY);
        ctx.strokeStyle='rgba(50,34,8,0.22)'; ctx.lineWidth=BAR_THICK; ctx.stroke();

        if(animPct>0.004){
            const fillW=Math.max(8,(barW-52)*animPct);
            ctx.beginPath();
            ctx.moveTo(barX,barY); ctx.lineTo(barX+fillW,barY);
            ctx.strokeStyle=isWin?'rgba(180,130,20,0.95)':'rgba(80,55,10,0.68)';
            ctx.lineWidth=BAR_THICK;
            if(isWin){ctx.shadowColor='rgba(200,160,40,0.40)';ctx.shadowBlur=5;}
            ctx.stroke(); ctx.shadowBlur=0;
        }
    });

    const ftrTop=y+HDR+choices.length*ROW;
    ctx.beginPath();
    ctx.moveTo(x+CP,ftrTop+5); ctx.lineTo(x+W-CP,ftrTop+5);
    ctx.strokeStyle='rgba(50,34,8,0.30)'; ctx.lineWidth=1; ctx.stroke();

    const fLblY=ftrTop+19, fValY=ftrTop+35;
    ctx.font=`400 ${fz(11)}px ${cfg.fontFamily}`; ctx.fillStyle='#3a2a10'; ctx.textAlign='center';
    ctx.fillText('Unique votes:',x+W*0.28,fLblY);
    ctx.fillText('Time active:',x+W*0.72,fLblY);
    ctx.font=`700 ${fz(13)}px ${cfg.fontFamily}`; ctx.fillStyle='#1a1208';
    ctx.fillText(`${totalReal}`,x+W*0.28,fValY);
    if(!isEnd&&poll.startedAt){
        const el=Math.floor((Date.now()-new Date(poll.startedAt))/1000);
        const hh=Math.floor(el/3600),mm=Math.floor((el%3600)/60),ss=el%60;
        ctx.fillText(hh>0?`${hh}h ${mm}m`:`${mm}m ${ss}s`,x+W*0.72,fValY);
    } else if(isEnd){
        ctx.fillText(isCancelled?'Cancelled':'Ended',x+W*0.72,fValY);
    }

    ctx.restore();
}

function _drawInkBrush(x,y,W,H,r,g,b,alpha,op){
    if(!_inkBrushOC){
        _inkBrushOC=document.createElement('canvas');
        _inkBrushOC.width=canvas.width; _inkBrushOC.height=canvas.height;
        _inkBrushOX=_inkBrushOC.getContext('2d');
    }
    _inkBrushOX.clearRect(0,0,canvas.width,canvas.height);
    if(!_inkRawImg){ return; }
    const imgAR=_inkRawImg.width/_inkRawImg.height;
    const panAR=W/H;
    let imgW,imgH;
    if(imgAR>panAR){ imgH=H*1.4; imgW=imgH*imgAR; }
    else { imgW=W*1.4; imgH=imgW/imgAR; }
    const imgX=x+W*0.5-imgW/2, imgY=y+H*0.5-imgH/2;
    _inkBrushOX.drawImage(_inkRawImg,imgX,imgY,imgW,imgH);
    _inkBrushOX.globalCompositeOperation='source-in';
    _inkBrushOX.fillStyle=`rgb(${r},${g},${b})`;
    _inkBrushOX.fillRect(imgX,imgY,imgW,imgH);
    _inkBrushOX.globalCompositeOperation='source-over';
    ctx.save();
    ctx.globalAlpha=alpha*op;
    ctx.drawImage(_inkBrushOC,0,0);
    ctx.restore();
}

function drawPanelBrush(alpha,ts){
    if(!poll) return;
    const geo=panelGeometry();
    const {x,y,W,H,PAD,HDR_H,ROW_H,FTR_H}=geo;
    const isEnd=poll.eventType==='END';
    const isCancelled=isEnd&&poll.status==='archived';
    const totalReal=choices.reduce((s,c)=>s+c.votes,0);
    const totalAnim=choices.reduce((s,c)=>s+c.animVotes,0);
    let winnerIdx=-1;
    if(isEnd&&!isCancelled&&totalReal>0)
        winnerIdx=choices.reduce((b,c,i)=>c.votes>choices[b].votes?i:b,0);

    ctx.save();
    ctx.globalAlpha=alpha;
    const op=cfg.bgOpacity;

    const _h1c=h2r(cfg.bgColor||'#0a1508');
    _drawInkBrush(x,y,W,H,_h1c.r,_h1c.g,_h1c.b,alpha,op);

    ctx.font=`700 ${fz(19)}px ${cfg.fontFamily}`;
    ctx.fillStyle=cfg.accentColor||'#f0c030';
    ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=5;
    ctx.textAlign='left';
    ctx.fillText(poll.title,x+PAD,y+HDR_H-18,W-PAD*2);
    ctx.shadowBlur=0;

    const subText=isCancelled?'Poll cancelled':isEnd?'Poll ended':'Type number (1,2...) or text in chat to vote';
    ctx.font=`400 ${fz(12)}px ${cfg.fontFamily}`;
    ctx.fillStyle='rgba(216,212,200,0.88)';
    ctx.textAlign='left';
    ctx.fillText(subText,x+PAD,y+HDR_H-8,W-PAD*2-60);

    if(!isEnd&&poll.endsAt){
        const rem=Math.max(0,Math.ceil((new Date(poll.endsAt)-Date.now())/1000));
        const m=Math.floor(rem/60),s=rem%60,urgent=rem<=10&&rem>0;
        ctx.textAlign='right';
        ctx.font=`600 ${fz(11)}px ${cfg.fontFamily}`;
        ctx.fillStyle=urgent?`rgba(255,80,20,${0.8+0.2*Math.abs(Math.sin(ts/120))})`:'rgba(155,150,135,0.65)';
        ctx.fillText(`${m}:${String(s).padStart(2,'0')}`,x+W-PAD,y+HDR_H-8);
        ctx.textAlign='left';
    }

    choices.forEach((choice,i)=>{
        const rowY=y+HDR_H+i*ROW_H;
        const textY=rowY+Math.round(ROW_H*0.46);
        const barY=rowY+Math.round(ROW_H*0.74);
        const barX=x+PAD+26, barW=W-PAD*2-26;
        const realPct=totalReal>0?(choice.votes/totalReal*100).toFixed(1):'0.0';
        const animPct=totalAnim>0?choice.animVotes/totalAnim:0;
        const isWin=i===winnerIdx;

        ctx.font=`700 ${fz(14)}px ${cfg.fontFamily}`;
        ctx.fillStyle='rgba(190,186,170,0.82)';
        ctx.textAlign='left';
        ctx.fillText(i+1,x+PAD+4,textY);

        ctx.font=`${isWin?'700':'400'} ${fz(16)}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?'#ffffff':'rgba(218,214,202,0.92)';
        if(isWin){ctx.shadowColor=rgba(cfg.accentColor||'#f0c030',0.30);ctx.shadowBlur=6;}
        ctx.textAlign='left';
        ctx.fillText(choice.title,barX,textY,barW-58);
        ctx.shadowBlur=0;

        ctx.font=`600 ${fz(15)}px ${cfg.fontFamily}`;
        ctx.fillStyle=isWin?(cfg.accentColor||'#f0c030'):'rgba(196,192,178,0.88)';
        ctx.textAlign='right';
        ctx.fillText(`${realPct}%`,x+W-PAD,textY);
        ctx.textAlign='left';

        ctx.beginPath();
        ctx.moveTo(barX,barY); ctx.lineTo(barX+barW-50,barY);
        ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1.5; ctx.stroke();

        if(animPct>0.004){
            const fillW=Math.max(6,(barW-50)*animPct);
            ctx.beginPath();
            ctx.moveTo(barX,barY); ctx.lineTo(barX+fillW,barY);
            ctx.strokeStyle=isWin?rgba(cfg.accentColor||'#f0c030',0.90):'rgba(176,172,158,0.72)';
            ctx.lineWidth=1.5;
            if(isWin){ctx.shadowColor=rgba(cfg.accentColor||'#f0c030',0.40);ctx.shadowBlur=5;}
            ctx.stroke(); ctx.shadowBlur=0;
        }
    });

    if(cfg.showFooter&&FTR_H>0){
        const ftrY=y+HDR_H+choices.length*ROW_H+Math.round(FTR_H*0.65);
        ctx.font=`400 ${fz(11)}px ${cfg.fontFamily}`;
        ctx.fillStyle='rgba(154,150,136,0.72)';
        ctx.textAlign='left';
        ctx.fillText(`Unique votes: ${totalReal}`,x+PAD+4,ftrY);
        if(!isEnd&&poll.startedAt){
            const el=Math.floor((Date.now()-new Date(poll.startedAt))/1000);
            const hh=Math.floor(el/3600),mm=Math.floor((el%3600)/60),ss=el%60;
            const ts2=hh>0?`${hh}h ${mm}m`:`${mm}m ${ss}s`;
            ctx.textAlign='right';
            ctx.fillStyle='rgba(205,190,130,0.88)';
            ctx.fillText(ts2,x+W-PAD,ftrY);
            const vw=ctx.measureText(ts2).width;
            ctx.fillStyle='rgba(154,150,136,0.72)';
            ctx.fillText('Time active: ',x+W-PAD-vw,ftrY);
        } else if(isEnd){
            ctx.textAlign='right';
            ctx.fillStyle='rgba(154,150,136,0.72)';
            ctx.fillText(isCancelled?'Cancelled':'Poll ended',x+W-PAD,ftrY);
        }
    }

    ctx.restore();
}

function drawPanel(alpha,ts){
    const style=cfg.overlayStyle||'default';
    if(style==='ink')   { drawPanelInk(alpha,ts);   return; }
    if(style==='hud')   { drawPanelHud(alpha,ts);   return; }
    if(style==='card')  { drawPanelCard(alpha,ts);  return; }
    if(style==='brush') { drawPanelBrush(alpha,ts);  return; }
    drawPanelDefault(alpha,ts);
}

function render(ts){
    requestAnimationFrame(render);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(phase==='hidden') return;

    scanOff=(ts/4)%(cfg.panelW+80);

    choices.forEach((c,i)=>{
        const prev=prevVotes[i]||0;
        c.animVotes+=(c.votes-c.animVotes)*.06;
        if(cfg.scorePop&&c.votes>prev&&phase==='active'){
            const geo=panelGeometry();
            const popY=geo.y+geo.HDR_H+i*geo.ROW_H+geo.ROW_H-geo.BAR_H-10;
            if(scorePopPool.length<20)
                scorePopPool.push({x:geo.x+geo.W-geo.PAD,y:popY,delta:c.votes-prev,life:1,color:cfg.accentColor});
        }
        prevVotes[i]=c.votes;
        if(c.pulsing){c.pulseLife-=.05; if(c.pulseLife<=0) c.pulsing=false;}
    });

    const elapsed=ts-phaseTs;
    let alpha=1;
    if(phase==='show'){
        alpha=Math.min(1,elapsed/FADE_MS);
        if(alpha>=1){phase='active';phaseTs=ts;}
    } else if(phase==='result'){
        const chickenExited = typeof ChickenAnim !== 'undefined' && ChickenAnim.exitedAfterEnd();
        if(chickenExited || elapsed>resultMs){phase='hide';phaseTs=ts;}
    } else if(phase==='hide'){
        alpha=Math.max(0,1-elapsed/FADE_MS);
        if(alpha<=0){phase='hidden';poll=null;choices=[];return;}
    }

    const geo=panelGeometry();
    updateScorePops();

    if(cfg.frameImageUrl&&cfg.frameImageUrl!==frameImgLoaded){
        const img=new Image();
        img.crossOrigin='anonymous';
        img.onload=()=>{frameImg=img;};
        img.src=cfg.frameImageUrl;
        frameImgLoaded=cfg.frameImageUrl;
    }
    if(!cfg.frameImageUrl){frameImg=null;frameImgLoaded='';}

    const chickenActive = typeof ChickenAnim !== 'undefined' && ChickenAnim.isActive();

    if(chickenActive){
        ChickenAnim.draw(ctx, ts, geo.x, geo.y, geo.W, geo.H, alpha);

        drawFrameImage(geo);
        drawScorePops();
    } else {
        drawFrameImage(geo);
        drawScorePops();
    }
}

function applyPollEvent(event){
    poll=event;
    (event.pollChoices||[]).forEach((c,i)=>{
        const votes=(c.totalVotes||0)+(c.channelPointVotes||0);
        if(choices[i]){
            if(votes>choices[i].votes){choices[i].pulsing=true;choices[i].pulseLife=1;}
            choices[i].title=c.title; choices[i].votes=votes;
        } else {
            choices[i]={title:c.title,votes,animVotes:0,pulsing:false,pulseLife:0};
            prevVotes[i]=votes;
        }
    });
    choices.length=(event.pollChoices||[]).length;
    if(event.eventType==='START'){
        phase='show'; phaseTs=performance.now();
        prevVotes=choices.map(c=>c.votes);
        if(typeof ChickenAnim!=='undefined') ChickenAnim.onPollStart();
    } else if(event.eventType==='PROGRESS'){
        if(typeof ChickenAnim!=='undefined') ChickenAnim.onPollResume();
    } else if(event.eventType==='END'){
        phase='result'; phaseTs=performance.now();
        if(typeof ChickenAnim!=='undefined'){
            event.status==='archived' ? ChickenAnim.onPollCancel() : ChickenAnim.onPollEnd();
        }
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
