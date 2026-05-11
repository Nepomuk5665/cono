(function(){
    'use strict';

    window.chickenCfg = {
        exitDir: 'right',
        size: 220,
        entryDir: 'top-left',
        rotation: 180,
        celebrationSequence: [4, 7, 3],
        celebrationMode: 'sequence',
        exitSequence: [6, 1],
        introEnabled: true,
        resultRevealDuration: 2800,
    };

    const AI = {
        walk:0, salto:1, lookUp:2, bow:3,
        dance1:4, wave:5, walkUp:6, dance2:7,
        freeze1:9, freeze2:10
    };

    const S = {
        HIDDEN:0, APPEARING:1, GREETING:2, LOOKING_UP:3,
        PANEL_REVEAL:4, ACTIVE:5, FROZEN:6, THAWING:7,
        RESOLVED:8, CELEBRATING:9, EXITING:10
    };

    let state = S.HIDDEN, stateTs = 0, cancelMode = false;
    let renderer, scene, camera, mixer, model, clock;
    let ambientLight, blueLight, goldLight;
    let actions = [], currentAction = null, loaded = false;
    let baseScale = 1, modelBotOff = 0;
    let panelX = 40, panelW = 460, panelY = 40;
    let freezeAmt = 0, freezePhase = false, freezeIv = null;
    let seqTimer = null;
    let modelMats = null;

    const FOV = 50, ZD = 5;
    const visH = 2 * Math.tan((FOV * Math.PI / 180) / 2) * ZD;
    const WPP = visH / 1080;

    function sx(px){ return (px - 960) * WPP; }
    function sy(py){ return -(py - 540) * WPP; }
    function restX(){ return sx(panelX + panelW + 80); }
    function restY(){ return sy(panelY + window.chickenCfg.size * 1.05); }
    function offL(){ return { x: sx(-300), y: restY() }; }
    function offR(){ return { x: sx(2200), y: restY() }; }

    function init(){
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(1920, 1080);
        renderer.setPixelRatio(1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        const cvs = renderer.domElement;
        cvs.id = 'chickenCanvas';
        cvs.style.display = 'block';
        (document.getElementById('chickenContainer') || document.body).appendChild(cvs);
        if(typeof window.scalePreview === 'function') window.scalePreview();

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(FOV, 1920/1080, 0.1, 1000);
        camera.position.set(0, 0, ZD);

        ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);
        const dl = new THREE.DirectionalLight(0xffffff, 1.5);
        dl.position.set(3, 5, 3);
        scene.add(dl);
        blueLight = new THREE.PointLight(0x4488ff, 0, 10);
        blueLight.position.set(-2, 2, 3);
        scene.add(blueLight);
        goldLight = new THREE.PointLight(0xffc060, 0, 10);
        goldLight.position.set(2, 3, 3);
        scene.add(goldLight);

        clock = new THREE.Clock();

        new THREE.GLTFLoader().load('/poll/chicken.glb', function(gltf){
            model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const h = box.getSize(new THREE.Vector3()).y;
            baseScale = (340 * WPP) / h;
            model.scale.setScalar(baseScale);
            const box2 = new THREE.Box3().setFromObject(model);
            modelBotOff = -box2.min.y;
            model.position.set(-100, 0, 0);
            scene.add(model);

            mixer = new THREE.AnimationMixer(model);
            actions = gltf.animations.map(function(c){ return mixer.clipAction(c); });

            modelMats = [];
            model.traverse(function(o){
                if(o.isMesh){
                    [].concat(o.material).forEach(function(m){
                        m.transparent = true;
                        modelMats.push(m);
                    });
                }
            });

            loaded = true;
            if(state !== S.HIDDEN) go(state);
        });

        (function loop(){
            requestAnimationFrame(loop);
            if(mixer) mixer.update(clock.getDelta());
            tick();
            updateLights();
            renderer.render(scene, camera);
        })();
    }

    function playAnim(idx, looped){
        if(!mixer || !actions[idx]) return;
        if(currentAction) currentAction.fadeOut(0.3);
        currentAction = actions[idx];
        const loop = looped !== false;
        currentAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        if(!loop) currentAction.clampWhenFinished = true;
        currentAction.reset().fadeIn(0.3).play();
    }

    function dur(idx){
        return (actions[idx] && actions[idx]._clip) ? actions[idx]._clip.duration * 1000 : 2000;
    }

    function playSeq(seq, loopLast, cb){
        clearTimeout(seqTimer);
        if(!seq.length){ if(cb) cb(); return; }
        const idx = seq[0];
        const rest = seq.slice(1);
        const isLast = !rest.length;
        playAnim(idx, isLast ? loopLast : true);
        if(!isLast){
            seqTimer = setTimeout(function(){ playSeq(rest, loopLast, cb); }, dur(idx) - 300);
        } else if(cb && !loopLast){
            seqTimer = setTimeout(cb, dur(idx) - 200);
        }
    }

    function setAlpha(a){
        if(!modelMats) return;
        modelMats.forEach(function(m){ m.opacity = a; });
    }

    function tick(){
        if(!model) return;
        const el = performance.now() - stateTs;
        const sc = window.chickenCfg.size / 340;
        model.scale.setScalar(baseScale * sc);
        const rx = restX(), ry = restY() + modelBotOff;
        const rot = (window.chickenCfg.rotation || 0) * Math.PI / 180;

        if(state === S.APPEARING){
            const a = Math.min(1, el / 500);
            setAlpha(a);
            model.position.set(rx, ry, 0);
            model.rotation.y = rot;
            if(a >= 1) go(S.GREETING);

        } else if(state === S.GREETING || state === S.LOOKING_UP){
            model.position.set(rx, ry, 0);
            model.rotation.y = rot;

        } else if(state === S.PANEL_REVEAL){
            model.position.set(rx, ry, 0);
            model.rotation.y = rot;
            if(el >= 1000) go(S.ACTIVE);

        } else if(state === S.ACTIVE || state === S.FROZEN || state === S.THAWING || state === S.RESOLVED || state === S.CELEBRATING){
            model.position.set(rx, ry, 0);
            model.rotation.y = rot;

        } else if(state === S.EXITING){
            const t = Math.min(el / 1400, 1);
            const dir = window.chickenCfg.exitDir === 'right' ? 1 : -1;
            const tgt = dir > 0 ? offR() : offL();
            model.position.set(rx + (tgt.x - rx) * (t * t), ry, 0);
            model.rotation.y = dir > 0 ? 0 : Math.PI;
            if(t >= 1){
                state = S.HIDDEN;
                model.position.x = -100;
                if(currentAction){ currentAction.stop(); currentAction = null; }
                setAlpha(1);
            }
        }
    }

    function updateLights(){
        if(!ambientLight) return;
        if(state === S.FROZEN){
            freezeAmt = Math.min(1, freezeAmt + 0.01);
        } else if(state === S.THAWING){
            freezeAmt = Math.max(0, freezeAmt - 0.015);
            if(freezeAmt <= 0) go(S.ACTIVE);
        } else {
            freezeAmt = Math.max(0, freezeAmt - 0.005);
        }
        ambientLight.color.setRGB(1 - 0.4 * freezeAmt, 1 - 0.2 * freezeAmt, 1);
        blueLight.intensity = 3 * freezeAmt;
        const celebrating = (state === S.RESOLVED || state === S.CELEBRATING) && !cancelMode;
        goldLight.intensity += ((celebrating ? 2.5 : 0) - goldLight.intensity) * 0.04;
    }

    function go(s){
        state = s;
        stateTs = performance.now();
        clearTimeout(seqTimer);
        clearInterval(freezeIv);
        if(!loaded) return;

        if(s === S.APPEARING){
            setAlpha(0);
            model.position.set(restX(), restY() + modelBotOff, 0);
            playAnim(AI.walk);

        } else if(s === S.GREETING){
            if(window.chickenCfg.introEnabled !== false){
                playAnim(AI.wave, false);
                seqTimer = setTimeout(function(){ go(S.LOOKING_UP); }, Math.min(dur(AI.wave) - 200, 1800));
            } else {
                go(S.PANEL_REVEAL);
            }

        } else if(s === S.LOOKING_UP){
            playAnim(AI.lookUp, false);
            seqTimer = setTimeout(function(){ go(S.PANEL_REVEAL); }, Math.min(dur(AI.lookUp) - 200, 1000));

        } else if(s === S.PANEL_REVEAL){
            playAnim(AI.walk);

        } else if(s === S.ACTIVE){
            playAnim(AI.walk);

        } else if(s === S.FROZEN){
            freezePhase = false;
            playAnim(AI.freeze1);
            freezeIv = setInterval(function(){
                if(state !== S.FROZEN){ clearInterval(freezeIv); return; }
                freezePhase = !freezePhase;
                playAnim(freezePhase ? AI.freeze2 : AI.freeze1);
            }, 4000);

        } else if(s === S.THAWING){
            playAnim(AI.walk);

        } else if(s === S.RESOLVED){
            playAnim(AI.walk);
            const revDur = (window.chickenCfg.resultRevealDuration || 2800) + 600;
            seqTimer = setTimeout(function(){ go(S.CELEBRATING); }, revDur);

        } else if(s === S.CELEBRATING){
            if(cancelMode){
                playSeq([AI.walkUp, AI.salto], false, function(){ go(S.EXITING); });
            } else {
                var seq;
                const cfg = window.chickenCfg;
                if(cfg.celebrationMode === 'random'){
                    const pool = [AI.dance1, AI.dance2, AI.bow];
                    seq = [pool[Math.floor(Math.random()*pool.length)], pool[Math.floor(Math.random()*pool.length)]];
                } else {
                    seq = cfg.celebrationSequence || [AI.dance1, AI.dance2, AI.bow];
                }
                playSeq(seq, false, function(){ go(S.EXITING); });
            }

        } else if(s === S.EXITING){
            const exitSeq = cancelMode ? [AI.walk] : (window.chickenCfg.exitSequence || [AI.walkUp, AI.salto]);
            playSeq(exitSeq, true, null);
        }
    }

    window.ChickenAnim = {
        onPollStart:    function(){ cancelMode = false; go(S.APPEARING); },
        onPollPause:    function(){ if(state !== S.HIDDEN && state !== S.FROZEN) go(S.FROZEN); },
        onPollResume:   function(){ if(state === S.FROZEN) go(S.THAWING); },
        onPollEnd:      function(){ cancelMode = false; go(S.RESOLVED); },
        onPollCancel:   function(){ cancelMode = true; go(S.CELEBRATING); },
        setCfg: function(px, py, pw){
            panelX = px !== undefined ? px : 40;
            panelY = py !== undefined ? py : 40;
            panelW = pw !== undefined ? pw : 460;
        },
        previewAnim: function(idx){ if(actions[idx]) playAnim(idx); },
    };

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
})();
