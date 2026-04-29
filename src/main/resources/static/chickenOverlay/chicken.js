(function(){
    'use strict';

    const CFG = { size: 340, model: 'rooster', exitDir: 'right', posX: 200, posY: 80 };

    const S = { HIDDEN:0, ENTERING:1, HOLDING:2, FROZEN:3, THAWING:4, CELEBRATING:5, EXITING:6 };
    let state = S.HIDDEN, stateStart = 0;
    let freezeAmt = 0, hadPollEnd = false, celebStyle = 0;

    let renderer, scene, camera, chickenGroup, shadowMesh, keyLight, rimLight, freezeLight;
    let modelReady = false;
    let mats = {};

    function init(){
        const cv = document.createElement('canvas');
        cv.width = 1920; cv.height = 1080;
        cv.style.cssText = 'position:absolute;top:0;left:0;';
        document.body.appendChild(cv);

        renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
        renderer.setSize(1920, 1080, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(0, 1920, 1080, 0, -2000, 2000);
        camera.position.z = 500;

        scene.add(new THREE.AmbientLight(0xffffff, 0.65));

        keyLight = new THREE.DirectionalLight(0xffe4b0, 2.2);
        keyLight.position.set(-300, 500, 600);
        keyLight.castShadow = true;
        scene.add(keyLight);

        rimLight = new THREE.DirectionalLight(0x7ab0ff, 0.5);
        rimLight.position.set(400, 200, -400);
        scene.add(rimLight);

        freezeLight = new THREE.PointLight(0x00cfff, 0, 800);
        scene.add(freezeLight);

        const sGeo = new THREE.CircleGeometry(0.5, 32);
        const sMat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.25, depthWrite:false });
        shadowMesh = new THREE.Mesh(sGeo, sMat);
        shadowMesh.renderOrder = -1;
        scene.add(shadowMesh);

        loadModel();
        requestAnimationFrame(loop);
    }

    function makeMat(hex){
        const grad = new THREE.DataTexture(new Uint8Array([60, 140, 220, 255]), 4, 1, THREE.LuminanceFormat);
        grad.minFilter = grad.magFilter = THREE.NearestFilter;
        grad.needsUpdate = true;
        return new THREE.MeshToonMaterial({ color: new THREE.Color(hex), gradientMap: grad });
    }

    function loadModel(){
        const draco = new THREE.DRACOLoader();
        draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');

        const loader = new THREE.GLTFLoader();
        loader.setDRACOLoader(draco);

        loader.load('/chickenOverlay/assets/chicken/' + CFG.model + '.glb', function(gltf){
            chickenGroup = new THREE.Group();

            const box = new THREE.Box3().setFromObject(gltf.scene);
            const sz = new THREE.Vector3();
            box.getSize(sz);
            const scale = CFG.size / Math.max(sz.x, sz.y, sz.z);
            gltf.scene.scale.setScalar(scale);

            const center = new THREE.Vector3();
            box.getCenter(center);
            gltf.scene.position.set(-center.x*scale, -center.y*scale, -center.z*scale);

            mats.body  = makeMat('#E07520');
            mats.belly = makeMat('#F0A030');
            mats.leg   = makeMat('#F0C030');
            mats.dark  = makeMat('#C04010');

            gltf.scene.traverse(function(child){
                if(!child.isMesh) return;
                const worldY = child.position.y * scale;
                child.material = worldY < -CFG.size * 0.25 ? mats.leg : mats.body;
                child.castShadow = true;
            });

            chickenGroup.add(gltf.scene);
            scene.add(chickenGroup);
            modelReady = true;
        });
    }

    function go(s){
        state = s;
        stateStart = performance.now();
        if(s === S.CELEBRATING) celebStyle = Math.floor(Math.random() * 3);
    }

    function loop(ts){
        requestAnimationFrame(loop);
        if(state === S.HIDDEN || !modelReady){
            renderer.clear();
            return;
        }

        const el = ts - stateStart;
        const half = CFG.size * 0.5;
        let sx = CFG.posX, sy = CFG.posY + half;
        let sc = 1, rotY = 0, rotZ = 0;

        if(state === S.ENTERING){
            const t = Math.min(el/1600, 1), ease = 1 - Math.pow(1-t, 3);
            sy = (CFG.posY - 320 + 320*ease) + half;
            sx = CFG.posX + Math.sin(ts*0.007)*18*(1-ease);
            sc = 0.5 + 0.5*ease;
            rotY = (1-ease) * Math.PI * 2;
            rotZ = Math.sin(ts*0.009)*0.07*(1-ease);
            if(t >= 1) go(S.HOLDING);

        } else if(state === S.HOLDING){
            sy = CFG.posY + 4*Math.sin(ts*0.0018) + half;
            sc = 1 + 0.012*Math.sin(ts*0.0022);
            rotZ = 0.025*Math.sin(ts*0.0014);
            rotY = el < 900 ? (el/900)*Math.PI*2 : 0;

        } else if(state === S.FROZEN){
            const t = Math.min(el/1000, 1);
            freezeAmt = t;
            sy = CFG.posY + 4*Math.sin(ts*0.0018)*(1-t) + half;
            sc = 1 + 0.012*Math.sin(ts*0.0022)*(1-t);
            rotZ = 0.025*Math.sin(ts*0.0014)*(1-t);

        } else if(state === S.THAWING){
            const t = Math.min(el/700, 1);
            freezeAmt = 1 - t;
            sy = CFG.posY + 4*Math.sin(ts*0.0018)*t + half;
            sc = 1 + 0.012*Math.sin(ts*0.0022)*t;
            rotZ = 0.025*Math.sin(ts*0.0014)*t;
            if(t >= 1){ freezeAmt = 0; go(S.HOLDING); }

        } else if(state === S.CELEBRATING){
            const t = Math.min(el/3200, 1);
            if(celebStyle === 0){
                sy = CFG.posY - Math.abs(Math.sin(ts*0.012))*55 + half;
                sc = 1 + 0.10*Math.abs(Math.sin(ts*0.012));
                rotY = ts*0.004;
            } else if(celebStyle === 1){
                sy = CFG.posY + 5*Math.sin(ts*0.008) + half;
                sc = 1 + 0.06*Math.sin(ts*0.016);
                rotY = ts*0.009;
            } else {
                sy = CFG.posY + 8*Math.abs(Math.sin(ts*0.014)) + half;
                sc = 1 + 0.04*Math.abs(Math.sin(ts*0.018));
                rotZ = 0.28*Math.sin(ts*0.018);
                rotY = ts*0.006;
            }
            if(t >= 1) go(S.EXITING);

        } else if(state === S.EXITING){
            const t = Math.min(el/1400, 1), ease = t*t;
            const dir = CFG.exitDir === 'right' ? 1 : -1;
            sx = CFG.posX + dir*1100*ease;
            sy = CFG.posY + 5*Math.sin(ts*0.015) + half;
            sc = 1 - 0.35*t;
            rotY = ts*0.012;
            rotZ = dir*0.12*Math.sin(ts*0.015);
            if(t >= 1){ state = S.HIDDEN; return; }
        }

        chickenGroup.position.set(sx, 1080 - sy, 0);
        chickenGroup.scale.setScalar(sc);
        chickenGroup.rotation.y = rotY;
        chickenGroup.rotation.z = rotZ;

        const shW = CFG.size * sc * 0.55;
        shadowMesh.scale.set(shW, shW*0.22, 1);
        shadowMesh.position.set(sx, 1080 - sy - half*sc*0.9, -1);
        shadowMesh.material.opacity = 0.22 * (1 - freezeAmt*0.5);

        if(freezeAmt > 0){
            Object.values(mats).forEach(m => {
                m.color.setRGB(
                    m.color.r*(1-freezeAmt*0.4) + 0.4*freezeAmt,
                    m.color.g*(1-freezeAmt*0.3) + 0.6*freezeAmt,
                    m.color.b*(1-freezeAmt*0.2) + 1.0*freezeAmt
                );
            });
            keyLight.color.setRGB(0.5, 0.8, 1.0);
            keyLight.intensity = 1.5 + freezeAmt*1.5;
            freezeLight.intensity = freezeAmt*4;
            freezeLight.position.set(sx, 1080 - sy, 400);
        } else {
            mats.body.color.setHex(0xE07520);
            mats.belly.color.setHex(0xF0A030);
            mats.leg.color.setHex(0xF0C030);
            mats.dark.color.setHex(0xC04010);
            keyLight.color.setRGB(1.0, 0.9, 0.7);
            keyLight.intensity = 2.2;
            freezeLight.intensity = 0;
        }

        renderer.render(scene, camera);
    }

    function onPollEvent(event){
        if(event.eventType === 'START')    { hadPollEnd=false; go(S.ENTERING); }
        else if(event.eventType === 'PROGRESS'){ if(state===S.FROZEN) go(S.THAWING); }
        else if(event.eventType === 'END') { hadPollEnd=true; go(S.CELEBRATING); }
    }

    function onCommand(cmd){
        if(cmd.cmd === 'pollPause'  && (state===S.HOLDING||state===S.THAWING)) go(S.FROZEN);
        if(cmd.cmd === 'pollResume' && state===S.FROZEN) go(S.THAWING);
        if(cmd.cmd === 'chickenCfg') Object.assign(CFG, cmd);
    }

    function onBackendConnect(b){
        b.subscribe('/topic/channelPollReceived', onPollEvent);
        b.subscribe('/topic/object', onCommand);
    }

    (function tryInit(){
        if(window.THREE && window.THREE.DRACOLoader){ init(); new Backend(onBackendConnect); }
        else setTimeout(tryInit, 80);
    })();

})();
