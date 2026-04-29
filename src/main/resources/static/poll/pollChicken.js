(function(){
    'use strict';

    window.chickenCfg = { exitDir: 'right', size: 340 };

    const S = {HIDDEN:0,ENTERING:1,HOLDING:2,FROZEN:3,THAWING:4,CELEBRATING:5,EXITING:6};
    let state = S.HIDDEN, stateStart = 0;
    let freezeAmt = 0;
    let hadPollEnd = false;
    let celebRow = 0;

    let renderer, scene, camera, chickenMesh, shadowMesh, keyLight, rimLight, freezeLight;
    let threeReady = false;

    function initThree(){
        if(!window.THREE) return;

        const cv = document.createElement('canvas');
        cv.width = 1920; cv.height = 1080;
        cv.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
        document.body.appendChild(cv);

        renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
        renderer.setSize(1920, 1080, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();

        camera = new THREE.OrthographicCamera(0, 1920, 1080, 0, -1000, 1000);
        camera.position.z = 500;

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        keyLight = new THREE.DirectionalLight(0xffe4b0, 2.0);
        keyLight.position.set(-300, 400, 600);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(512, 512);
        scene.add(keyLight);

        rimLight = new THREE.DirectionalLight(0x7ab0ff, 0.6);
        rimLight.position.set(400, 200, -400);
        scene.add(rimLight);

        freezeLight = new THREE.PointLight(0x00cfff, 0, 600);
        scene.add(freezeLight);

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshStandardMaterial({
            transparent: true,
            alphaTest: 0.04,
            side: THREE.FrontSide,
            roughness: 0.9,
            metalness: 0.0,
        });
        chickenMesh = new THREE.Mesh(geo, mat);
        chickenMesh.castShadow = true;
        scene.add(chickenMesh);

        const sGeo = new THREE.CircleGeometry(0.5, 32);
        const sMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
        });
        shadowMesh = new THREE.Mesh(sGeo, sMat);
        shadowMesh.renderOrder = -1;
        scene.add(shadowMesh);

        threeReady = true;
    }

    (function tryInit(){ window.THREE ? initThree() : setTimeout(tryInit, 80); })();

    let walkTex = [], idleTex = [], danceTex = [], sitTex = [];

    function loadFrames(base, prefix, count, onDone){
        const imgs = new Array(count);
        let done = 0;
        for(let i = 0; i < count; i++){
            const img = new Image();
            const idx = i;
            img.onload = img.onerror = function(){
                if(++done === count) onDone(imgs);
            };
            imgs[idx] = img;
            img.src = base + prefix + '_' + String(i+1).padStart(2,'0') + '.png';
        }
    }

    function toTex(img){
        if(!window.THREE) return null;
        const t = new THREE.Texture(img);
        t.needsUpdate = true;
        if(THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    loadFrames('/chickenOverlay/assets/chicken/walk/',  'walk',  12, imgs => { walkTex  = imgs.map(toTex); });
    loadFrames('/chickenOverlay/assets/chicken/idle/',  'idle',   6, imgs => { idleTex  = imgs.map(toTex); });
    loadFrames('/chickenOverlay/assets/chicken/dance/', 'dance', 18, imgs => { danceTex = imgs.map(toTex); });
    loadFrames('/chickenOverlay/assets/chicken/sit/',   'sit',   12, imgs => { sitTex   = imgs.map(toTex); });

    function go(s){
        state = s;
        stateStart = performance.now();
        if(s === S.CELEBRATING) celebRow = Math.floor(Math.random() * 6);
    }

    function restPos(panelX, panelW){ return { x: panelX + panelW * 0.5, y: 0 }; }

    function getPanelOffset(ts){
        const el = ts - stateStart;
        if(state === S.ENTERING){
            const t = Math.min(el/1600,1), ease = 1-Math.pow(1-t,3);
            return { dx: Math.sin(ts*0.007)*12*(1-ease), dy: -320*(1-ease) };
        }
        if(state === S.HOLDING)   return { dx:0, dy: 4*Math.sin(ts*0.0018) };
        if(state === S.FROZEN){
            const t = Math.min(el/1000,1);
            return { dx:0, dy: 4*Math.sin(ts*0.0018)*(1-t) };
        }
        if(state === S.THAWING){
            const t = Math.min(el/700,1);
            return { dx:0, dy: 4*Math.sin(ts*0.0018)*t };
        }
        if(state === S.CELEBRATING){
            const cm = celebRow%3;
            if(cm===0) return { dx:0, dy:-Math.abs(Math.sin(ts*0.012))*25 };
            if(cm===1) return { dx:0, dy: 5*Math.sin(ts*0.008) };
            return { dx:0, dy: 8*Math.abs(Math.sin(ts*0.014)) };
        }
        if(state === S.EXITING){
            const t = Math.min(el/1400,1), ease = t*t;
            const dir = window.chickenCfg.exitDir==='right'?1:-1;
            return { dx: dir*1000*ease, dy: 5*Math.sin(ts*0.015) };
        }
        return { dx:0, dy:0 };
    }

    function getTransform(ts, panelX, panelW){
        const el = ts - stateStart;
        const rest = restPos(panelX, panelW);
        let x=rest.x, y=rest.y, rot=0, sc=1;

        if(state === S.ENTERING){
            const t = Math.min(el/1600,1), ease = 1-Math.pow(1-t,3);
            y   = -320 + 320*ease;
            x   = rest.x + Math.sin(ts*0.007)*18*(1-ease);
            rot = Math.sin(ts*0.009)*0.07*(1-ease);
            sc  = 0.5+0.5*ease;
            if(t>=1) go(S.HOLDING);

        } else if(state === S.HOLDING){
            y   = rest.y + 4*Math.sin(ts*0.0018);
            sc  = 1 + 0.012*Math.sin(ts*0.0022);
            rot = 0.025*Math.sin(ts*0.0014);

        } else if(state === S.FROZEN){
            const t = Math.min(el/1000,1);
            freezeAmt = t;
            y   = rest.y + 4*Math.sin(ts*0.0018)*(1-t);
            sc  = 1 + 0.012*Math.sin(ts*0.0022)*(1-t);
            rot = 0.025*Math.sin(ts*0.0014)*(1-t);

        } else if(state === S.THAWING){
            const t = Math.min(el/700,1);
            freezeAmt = 1-t;
            y   = rest.y + 4*Math.sin(ts*0.0018)*t;
            sc  = 1 + 0.012*Math.sin(ts*0.0022)*t;
            rot = 0.025*Math.sin(ts*0.0014)*t;
            if(t>=1){ freezeAmt=0; go(S.HOLDING); }

        } else if(state === S.CELEBRATING){
            const t = Math.min(el/3200,1), cm = celebRow%3;
            if(cm===0){
                y  = rest.y - Math.abs(Math.sin(ts*0.012))*55;
                sc = 1 + 0.10*Math.abs(Math.sin(ts*0.012));
            } else if(cm===1){
                rot = ts*0.009;
                sc  = 1 + 0.06*Math.sin(ts*0.016);
                y   = rest.y + 5*Math.sin(ts*0.008);
            } else {
                rot = 0.28*Math.sin(ts*0.018);
                sc  = 1 + 0.04*Math.abs(Math.sin(ts*0.018));
                y   = rest.y + 8*Math.abs(Math.sin(ts*0.014));
            }
            if(t>=1) go(S.EXITING);

        } else if(state === S.EXITING){
            const t = Math.min(el/1400,1), ease = t*t;
            const dir = window.chickenCfg.exitDir==='right'?1:-1;
            x   = rest.x + dir*1000*ease;
            y   = rest.y + 5*Math.sin(ts*0.015);
            rot = dir*0.12*Math.sin(ts*0.015);
            sc  = 1-0.35*t;
            if(t>=1) state = S.HIDDEN;
        }
        return {x, y, rot, sc};
    }

    function getTexture(ts){
        const el = ts - stateStart;

        if(state === S.ENTERING || state === S.EXITING){
            if(walkTex.length) return walkTex[Math.floor(el/83) % walkTex.length];
        }

        if(state === S.HOLDING || state === S.FROZEN || state === S.THAWING){
            if(!idleTex.length) return null;
            const SPIN_DUR = 900;
            if(state === S.HOLDING && el < SPIN_DUR){

                const frameIdx = Math.floor((el / SPIN_DUR) * idleTex.length) % idleTex.length;
                return idleTex[frameIdx];
            }

            const slowEl = state === S.HOLDING ? el - SPIN_DUR : el;
            const fi = Math.round(Math.abs(Math.sin(slowEl * 0.0006)) * 1.5) % idleTex.length;
            return idleTex[fi];
        }

        if(state === S.CELEBRATING){
            const pool = celebRow < 3 ? danceTex : sitTex;
            if(pool.length) return pool[Math.floor(el/83) % pool.length];
        }

        return null;
    }

    function draw(ctx, ts, panelX, panelY, panelW, panelH, alpha){
        if(state === S.HIDDEN){
            if(threeReady){ renderer.clear(); }
            return false;
        }
        if(!threeReady) return false;

        const {x, y, rot, sc} = getTransform(ts, panelX, panelW);
        const tex = getTexture(ts);
        if(!tex || !tex.image || !tex.image.naturalWidth) return false;

        const cfg = window.chickenCfg;
        const ch  = cfg.size * sc;
        const img = tex.image;
        const cw  = ch * (img.naturalWidth / img.naturalHeight);

        const sx = x;
        const sy = panelY + y + ch * 0.5;

        const tx = sx;
        const ty = 1080 - sy;

        const flipH = (state === S.EXITING && cfg.exitDir === 'left');
        chickenMesh.scale.set(cw * (flipH ? -1 : 1), ch, 1);
        chickenMesh.position.set(tx, ty, 0);
        chickenMesh.rotation.z = rot;

        if(chickenMesh.material.map !== tex){
            chickenMesh.material.map = tex;
            chickenMesh.material.needsUpdate = true;
        }
        chickenMesh.material.opacity = alpha;

        const shW = cw * 0.55;
        const shH = shW * 0.22;
        shadowMesh.scale.set(shW, shH, 1);
        shadowMesh.position.set(tx, ty - ch * 0.47, -1);
        shadowMesh.material.opacity = 0.22 * alpha * (1 - freezeAmt * 0.5);

        if(freezeAmt > 0){

            keyLight.color.setRGB(0.5 + 0.1*(1-freezeAmt), 0.8, 1.0);
            keyLight.intensity = 1.5 + freezeAmt * 1.5;
            rimLight.color.setRGB(0.2, 0.5, 1.0);
            rimLight.intensity = 0.8 + freezeAmt * 0.8;
            freezeLight.intensity = freezeAmt * 3.5;
            freezeLight.position.set(tx, ty, 300);

            const blue = freezeAmt * 0.45;
            chickenMesh.material.color.setRGB(1.0 - blue*0.3, 1.0 - blue*0.1, 1.0 + blue*0.2);
        } else {

            keyLight.color.setRGB(1.0, 0.9, 0.7);
            keyLight.intensity = 2.0;
            rimLight.color.setRGB(0.48, 0.69, 1.0);
            rimLight.intensity = 0.6;
            freezeLight.intensity = 0;
            chickenMesh.material.color.setRGB(1, 1, 1);
        }

        renderer.render(scene, camera);
        return true;
    }

    window.ChickenAnim = {
        S,
        onPollStart()  { hadPollEnd=false; go(S.ENTERING); },
        onPollPause()  { if(state===S.HOLDING||state===S.THAWING) go(S.FROZEN); },
        onPollResume() { if(state===S.FROZEN) go(S.THAWING); },
        onPollEnd()    { hadPollEnd=true; go(S.CELEBRATING); },
        onPollCancel() { hadPollEnd=true; go(S.EXITING); },
        isActive()     { return state !== S.HIDDEN; },
        getFreezeAmt() { return freezeAmt; },
        exitedAfterEnd(){ return hadPollEnd && state === S.HIDDEN; },
        getPanelOffset(ts){ return getPanelOffset(ts); },
        draw(ctx, ts, panelX, panelY, panelW, panelH, alpha){
            return draw(ctx, ts, panelX, panelY, panelW, panelH, alpha !== undefined ? alpha : 1);
        },
    };

})();
