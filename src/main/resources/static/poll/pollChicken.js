(function(){
    'use strict';

    window.chickenCfg = {
        size: 130,
        entryDir: 'top-left',
        rotation: -94,
        rotationX: 35,
        celebrationSequence: [4],
    };

    const AI = {
        walk:0, lookUp:2, bow:3,
        dance1:4, dance2:7,
        freeze1:9,
    };

    const S = {
        HIDDEN:0, APPEARING:1,
        ACTIVE:5, FROZEN:6, THAWING:7,
        CELEBRATING:9, EXITING:10
    };

    let state = S.HIDDEN, stateTs = 0, exitWithBow = false, exitCb = null;
    let renderer, scene, camera, mixer, model, clock;
    let ambientLight, blueLight, goldLight;
    let actions = [], currentAction = null, loaded = false;
    let baseScale = 1, modelBotOff = 0;
    let panelX = 40, panelW = 460, panelY = 40;
    let freezeAmt = 0;
    let seqTimer = null;
    let onEnteredCb = null;
    let modelMats = null;
    let rootBone = null;

    const FOV = 50, ZD = 5;
    const visH = 2 * Math.tan((FOV * Math.PI / 180) / 2) * ZD;
    const WPP = visH / 1080;

    function sx(px){ return (px - 960) * WPP; }
    function sy(py){ return -(py - 540) * WPP; }
    function restX(){ return sx(panelX + panelW + 55); }
    function restY(){ var panelH = panelW * (1024 / 1536); return sy(panelY + panelH * 0.87); }
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
        const container = document.getElementById('chickenContainer') || document.body;
        if(container !== document.body) container.style.zIndex = '10';
        container.appendChild(cvs);
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
            gltf.animations.forEach(function(clip){
                clip.tracks = clip.tracks.filter(function(track){
                    var isPos = track.name.indexOf('.position') !== -1;
                    var name = track.name.split('.')[0].toLowerCase();
                    var isRoot = name === 'root' || name === 'hips' || name === 'pelvis' || name === 'armature';
                    return !(isPos && isRoot);
                });
            });
            actions = gltf.animations.map(function(c){ return mixer.clipAction(c); });

            modelMats = [];
            model.traverse(function(o){
                if(o.isMesh){
                    [].concat(o.material).forEach(function(m){
                        m.transparent = true;
                        modelMats.push(m);
                    });
                }
                if(o.isBone && (!o.parent || !o.parent.isBone)) rootBone = o;
            });

            loaded = true;
            if(state !== S.HIDDEN) go(state);
        });

        (function loop(){
            requestAnimationFrame(loop);
            if(mixer) mixer.update(clock.getDelta());
            if(model){ model.children.forEach(function(c){ c.position.x = 0; c.position.z = 0; }); }
            if(rootBone){ rootBone.position.x = 0; rootBone.position.z = 0; }
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
        const rot  = (window.chickenCfg.rotation  || 0) * Math.PI / 180;
        const rotX = (window.chickenCfg.rotationX || 0) * Math.PI / 180;

        if(state === S.APPEARING){
            const ed = window.chickenCfg.entryDir || 'left';
            const fromRight = ed === 'right' || ed === 'top-right';
            const start = fromRight ? offR() : offL();
            const walkDur = dur(AI.walk) * 3 || 3500;
            const t = Math.min(el / walkDur, 1);
            const ease = t;
            model.position.set(start.x + (rx - start.x) * ease, ry, 0);
            model.rotation.y = fromRight ? Math.PI : 0;
            if(t >= 1) go(S.ACTIVE);

        } else if(state === S.ACTIVE || state === S.FROZEN || state === S.THAWING || state === S.CELEBRATING){
            model.position.set(rx, ry, 0);
            model.rotation.y = rot; model.rotation.x = rotX;

        } else if(state === S.EXITING){
            const bowDur = exitWithBow ? dur(AI.bow) : 0;
            if(el >= bowDur){
                if(exitCb){ var f = exitCb; exitCb = null; f(); }
                const t = Math.min(1, (el - bowDur) / 700);
                setAlpha(1 - t);
                if(t >= 1){
                    state = S.HIDDEN;
                    model.position.x = -100;
                    if(currentAction){ currentAction.stop(); currentAction = null; }
                    setAlpha(1);
                    exitWithBow = false;
                }
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
        const celebrating = state === S.CELEBRATING;
        goldLight.intensity += ((celebrating ? 2.5 : 0) - goldLight.intensity) * 0.04;
    }

    function go(s){
        state = s;
        stateTs = performance.now();
        clearTimeout(seqTimer);
        if(!loaded) return;

        if(s === S.APPEARING){
            setAlpha(1);
            const ed = window.chickenCfg.entryDir || 'left';
            const fromRight = ed === 'right' || ed === 'top-right';
            const start = fromRight ? offR() : offL();
            model.position.set(start.x, restY() + modelBotOff, 0);
            model.rotation.y = fromRight ? Math.PI : 0;
            if(mixer && actions[AI.walk]){
                if(currentAction) currentAction.fadeOut(0.1);
                currentAction = actions[AI.walk];
                currentAction.setLoop(THREE.LoopRepeat, 3);
                currentAction.clampWhenFinished = true;
                currentAction.reset().fadeIn(0.1).play();
            }

        } else if(s === S.ACTIVE){
            playAnim(AI.lookUp);
            if(onEnteredCb){ var cb = onEnteredCb; onEnteredCb = null; cb(); }

        } else if(s === S.FROZEN){
            playAnim(AI.freeze1);

        } else if(s === S.THAWING){
            playAnim(AI.walk);

        } else if(s === S.CELEBRATING){
            var seq = window.chickenCfg.celebrationSequence || [AI.dance1, AI.dance2, AI.bow];
            playSeq(seq, false, function(){ go(S.ACTIVE); });

        } else if(s === S.EXITING){
            if(exitWithBow){
                playSeq([AI.bow], false);
            } else {
                if(currentAction) currentAction.fadeOut(0.2);
                currentAction = null;
            }
        }
    }

    window.ChickenAnim = {
        onPollStart:    function(cb){ onEnteredCb = cb || null; go(S.APPEARING); },
        onPollPause:    function(){ if(state !== S.HIDDEN && state !== S.FROZEN) go(S.FROZEN); },
        onPollResume:   function(){ if(state === S.FROZEN) go(S.THAWING); },
        onPollEnd:      function(){ if(state === S.CELEBRATING || state === S.EXITING || state === S.HIDDEN) return; go(S.CELEBRATING); },
        onPollCancel:   function(){ exitWithBow = false; go(S.EXITING); },
        setCfg: function(px, py, pw){
            panelX = px !== undefined ? px : 40;
            panelY = py !== undefined ? py : 40;
            panelW = pw !== undefined ? pw : 460;
        },
        onPanelDisappear: function(cb){
            if(state === S.HIDDEN || state === S.EXITING){ if(cb) cb(); return; }
            exitWithBow = true;
            exitCb = cb || null;
            go(S.EXITING);
        },
        previewAnim: function(idx){ if(actions[idx]) playAnim(idx); },
        setVisible: function(v){
            var cvs = document.getElementById('chickenCanvas');
            if(cvs) cvs.style.display = v ? 'block' : 'none';
        },
    };

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
})();
