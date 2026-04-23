const CANVAS_W = 3840;
const CANVAS_H = 1080;
const SHIP_SIZE = 200;
const BOMB_SIZE = 150;
const TEXT_X_OFFSET = 90;
const TEXT_Y_OFFSET = 30;
const WINNER_X = 3500;
const PARTICLE_POOL_SIZE = 300;
const MAX_ACTIVE_PARTICLES = 200;
const AUDIO_POOL_SIZE = 3;
const POD_USERNAMES = "chaos1298,onecrazymonkeh";

let state = {};
let backend;
let gameAssets = 'assets/eve/';
let imageCache, particleSystem, screenShake, flashOverlay, audioPool;

const Ease = {
    linear: t => t,
    easeIn: t => t * t * t,
    easeOut: t => 1 - Math.pow(1 - t, 3),
    easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutBack: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutBounce: t => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
};

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randomNumber(min, max) { return Math.round(Math.random() * (max - min) + min); }

class ImageCache {
    constructor() {
        this.cache = new Map();
        this.offscreenCache = new Map();
    }

    load(src) {
        return new Promise(resolve => {
            if (this.cache.has(src)) {
                resolve(this.cache.get(src));
                return;
            }
            const img = new Image();
            img.onload = () => {
                this.cache.set(src, img);
                this._createOffscreen(src, img);
                resolve(img);
            };
            img.onerror = () => {
                this.cache.set(src, null);
                resolve(null);
            };
            img.src = src;
        });
    }

    get(src) {
        return this.cache.get(src) || null;
    }

    getOffscreen(src) {
        return this.offscreenCache.get(src) || null;
    }

    _createOffscreen(src, img) {
        const oc = document.createElement('canvas');
        oc.width = SHIP_SIZE + 24;
        oc.height = SHIP_SIZE + 24;
        const octx = oc.getContext('2d');
        octx.shadowColor = 'rgba(200, 200, 200, 0.5)';
        octx.shadowBlur = 12;
        octx.shadowOffsetX = 12;
        octx.drawImage(img, 12, 0, SHIP_SIZE, SHIP_SIZE);
        this.offscreenCache.set(src, oc);
    }

    isLoaded(src) {
        return this.cache.has(src);
    }
}

class ParticleSystem {
    constructor(poolSize) {
        this.pool = [];
        for (let i = 0; i < poolSize; i++) {
            this.pool.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0,
                life: 0, maxLife: 1, size: 4,
                r: 255, g: 200, b: 50, alpha: 1,
                drag: 0.98, gravity: 0
            });
        }
        this.activeCount = 0;
    }

    emit(x, y, config) {
        if (this.activeCount >= MAX_ACTIVE_PARTICLES) return;
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) {
                p.active = true;
                p.x = x;
                p.y = y;
                p.vx = config.vx || (Math.random() - 0.5) * 300;
                p.vy = config.vy || (Math.random() - 0.5) * 300;
                p.life = config.life || (0.5 + Math.random() * 0.8);
                p.maxLife = p.life;
                p.size = config.size || (3 + Math.random() * 5);
                p.r = config.r !== undefined ? config.r : 255;
                p.g = config.g !== undefined ? config.g : 200;
                p.b = config.b !== undefined ? config.b : 50;
                p.alpha = 1;
                p.drag = config.drag || 0.96;
                p.gravity = config.gravity || 100;
                this.activeCount++;
                return p;
            }
        }
    }

    emitBurst(x, y, count, config) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = (config.speed || 200) * (0.5 + Math.random());
            this.emit(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: config.life || (0.4 + Math.random() * 0.6),
                size: config.size || (3 + Math.random() * 5),
                r: config.r, g: config.g, b: config.b,
                drag: config.drag || 0.95,
                gravity: config.gravity || 80
            });
        }
    }

    update(dt) {
        this.activeCount = 0;
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) { p.active = false; continue; }
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = clamp(p.life / p.maxLife, 0, 1);
            this.activeCount++;
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

class ScreenShake {
    constructor() { this.intensity = 0; this.duration = 0; this.elapsed = 0; }
    trigger(intensity, duration) {
        this.intensity = intensity; this.duration = duration; this.elapsed = 0;
    }
    update(dt) {
        if (this.elapsed < this.duration) this.elapsed += dt;
    }
    getOffset() {
        if (this.elapsed >= this.duration) return { x: 0, y: 0 };
        const decay = 1 - (this.elapsed / this.duration);
        return {
            x: (Math.random() - 0.5) * 2 * this.intensity * decay,
            y: (Math.random() - 0.5) * 2 * this.intensity * decay
        };
    }
}

class FlashOverlay {
    constructor() { this.color = 'white'; this.alpha = 0; this.speed = 0; }
    trigger(color, intensity, duration) {
        this.color = color || 'white';
        this.alpha = intensity;
        this.speed = intensity / (duration / 1000);
    }
    update(dt) {
        if (this.alpha > 0) {
            this.alpha -= this.speed * dt;
            if (this.alpha < 0) this.alpha = 0;
        }
    }
    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalAlpha = 1;
    }
}

class AudioPool {
    constructor(src, poolSize) {
        this.clips = [];
        for (let i = 0; i < poolSize; i++) {
            const a = new Audio(src);
            a.volume = 0.3;
            this.clips.push(a);
        }
        this.index = 0;
    }
    play() {
        const clip = this.clips[this.index];
        clip.currentTime = 0;
        clip.play().catch(() => {});
        this.index = (this.index + 1) % this.clips.length;
    }
}

const AnimPhase = {
    ENTERING: 'entering', IDLE: 'idle', SLIDING: 'sliding',
    BOMBING: 'bombing', EXPLODING: 'exploding',
    WINNER_IDLE: 'winner_idle', THREATENED: 'threatened',
    DESTROYED: 'destroyed'
};

class Participant {
    constructor(name, shipImageKey, startX, startY, targetX, targetY) {
        this.name = name;
        this.shipImageKey = shipImageKey;
        this.x = startX;
        this.y = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.opacity = 0;
        this.scale = 0;
        this.alive = true;
        this.phase = AnimPhase.ENTERING;
        this.rank = 0;

        this.entryTime = 0;
        this.entryDuration = 6.0;
        this.scaleDuration = 1.5;

        this.bobPhase = Math.random() * Math.PI * 2;
        this.bobSpeed = 1.5 + Math.random() * 0.5;
        this.bobAmplitude = 5;

        this.bombX = 0;
        this.bombY = 0;
        this.bombTargetX = 0;
        this.bombActive = false;
        this.bombProgress = 0;
        this.bombDuration = 5;
        this.bombDelay = 0;
        this.bombTrail = [];

        this.winnerGlowTime = 0;

        this.explodeTime = 0;
        this.explodeDuration = 0.3;
        this.explosionTriggered = false;

        this.threatProgress = 0;
        this.threatDuration = 60;
    }

    update(dt, time) {
        switch (this.phase) {
            case AnimPhase.ENTERING:
                this.entryTime += dt;
                if (this.entryTime < this.scaleDuration) {
                    const t = this.entryTime / this.scaleDuration;
                    this.scale = Ease.easeOutBack(t);
                    this.opacity = clamp(t * 2, 0, 1);
                } else {
                    this.scale = 1;
                    this.opacity = 1;
                    const slideT = clamp((this.entryTime - this.scaleDuration) / (this.entryDuration - this.scaleDuration), 0, 1);
                    const eased = Ease.easeOut(slideT);
                    this.x = lerp(1920, this.targetX, eased);
                    if (slideT >= 1) {
                        this.phase = AnimPhase.IDLE;
                        this.x = this.targetX;
                    }
                }
                break;

            case AnimPhase.IDLE:
                this.y = this.targetY + Math.sin(time * this.bobSpeed + this.bobPhase) * this.bobAmplitude;
                break;

            case AnimPhase.SLIDING:
                break;

            case AnimPhase.BOMBING:
                if (this.bombDelay > 0) { this.bombDelay -= dt; break; }
                this.bombProgress += dt / this.bombDuration;
                if (this.bombProgress >= 1) {
                    this.bombProgress = 1;
                    this.phase = AnimPhase.EXPLODING;
                    this.explodeTime = 0;
                    this.explosionTriggered = false;
                }
                const bt = Ease.easeIn(this.bombProgress);
                const newBX = lerp(this.bombX, this.bombTargetX, bt);
                const newBY = lerp(this.bombY, this.y + (SHIP_SIZE - BOMB_SIZE) / 2, bt);
                this.bombTrail.push({ x: newBX, y: newBY });
                if (this.bombTrail.length > 6) this.bombTrail.shift();
                this.bombX = newBX;
                this.bombY = newBY;
                break;

            case AnimPhase.EXPLODING:
                this.explodeTime += dt;
                this.opacity = clamp(1 - this.explodeTime / this.explodeDuration, 0, 1);
                if (this.explodeTime >= this.explodeDuration) {
                    this.phase = AnimPhase.DESTROYED;
                    this.alive = false;
                }
                break;

            case AnimPhase.WINNER_IDLE:
                this.winnerGlowTime += dt;
                this.y = this.targetY + Math.sin(time * this.bobSpeed + this.bobPhase) * 3;
                break;

            case AnimPhase.THREATENED:
                this.threatProgress += dt / this.threatDuration;
                const wobble = Math.sin(time * 3 + this.bobPhase) * 8 * (1 + this.threatProgress);
                this.bombY = this.targetY + (SHIP_SIZE - BOMB_SIZE) / 2 + wobble;
                break;

            case AnimPhase.DESTROYED:
                break;
        }
    }

    drawShip(ctx, cache) {
        if (!this.alive && this.phase !== AnimPhase.EXPLODING) return;
        if (this.opacity <= 0) return;

        const oc = cache.getOffscreen(this.shipImageKey);
        ctx.globalAlpha = this.opacity;

        if (this.phase === AnimPhase.WINNER_IDLE || this.phase === AnimPhase.THREATENED) {
            const glowPulse = 0.5 + 0.5 * Math.sin(this.winnerGlowTime * 3);
            ctx.save();
            ctx.shadowColor = `rgba(255, 215, 0, ${0.4 + glowPulse * 0.4})`;
            ctx.shadowBlur = 15 + glowPulse * 10;
            if (oc) {
                ctx.drawImage(oc, this.x - 12, this.y, SHIP_SIZE, SHIP_SIZE);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillRect(this.x, this.y, SHIP_SIZE, SHIP_SIZE);
            }
            ctx.restore();
        } else {
            if (oc) {
                ctx.drawImage(oc, this.x - 12, this.y, SHIP_SIZE, SHIP_SIZE);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillRect(this.x, this.y, SHIP_SIZE, SHIP_SIZE);
            }
        }
        ctx.globalAlpha = 1;
    }

    drawText(ctx) {
        if (!this.alive && this.phase !== AnimPhase.EXPLODING) return;
        if (this.opacity <= 0) return;

        ctx.globalAlpha = this.opacity;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 1)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#fff';
        ctx.font = '30px "Eve Sans Neue", sans-serif';
        ctx.fillText(this.name, this.x + TEXT_X_OFFSET, this.y + TEXT_Y_OFFSET + 22);
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    drawBomb(ctx, cache) {
        if (!this.bombActive) return;
        if (this.phase !== AnimPhase.BOMBING && this.phase !== AnimPhase.THREATENED) return;

        const bombImg = cache.get(gameAssets + 'nuke.png');

        if (this.bombTrail.length > 1) {
            for (let i = 0; i < this.bombTrail.length - 1; i++) {
                const t = i / this.bombTrail.length;
                ctx.globalAlpha = t * 0.4;
                const trailSize = BOMB_SIZE * t * 0.7;
                if (bombImg) {
                    ctx.drawImage(bombImg, this.bombTrail[i].x, this.bombTrail[i].y, trailSize, trailSize);
                } else {
                    ctx.fillStyle = '#c66';
                    ctx.fillRect(this.bombTrail[i].x, this.bombTrail[i].y, trailSize, trailSize);
                }
            }
            ctx.globalAlpha = 1;
        }

        if (this.phase === AnimPhase.THREATENED) {
            const glowI = clamp(this.threatProgress, 0, 1);
            ctx.save();
            const r = Math.round(lerp(200, 255, glowI));
            const g = Math.round(lerp(150, 50, glowI));
            ctx.shadowColor = `rgba(${r}, ${g}, 50, ${0.3 + glowI * 0.5})`;
            ctx.shadowBlur = lerp(5, 25, glowI);
            if (bombImg) ctx.drawImage(bombImg, this.bombX, this.bombY, BOMB_SIZE, BOMB_SIZE);
            ctx.restore();
        } else {
            ctx.save();
            ctx.shadowColor = 'rgba(200, 150, 150, 0.5)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = -12;
            if (bombImg) {
                ctx.drawImage(bombImg, this.bombX, this.bombY, BOMB_SIZE, BOMB_SIZE);
            } else {
                ctx.fillStyle = '#c66';
                ctx.fillRect(this.bombX, this.bombY, BOMB_SIZE, BOMB_SIZE);
            }
            ctx.restore();
        }
    }
}

class AnimatedCounter {
    constructor() { this.current = 0; this.target = 0; }
    set(val) { this.target = val; }
    update(dt) {
        if (this.current < this.target) {
            this.current = Math.min(this.target, this.current + dt * 80);
        } else if (this.current > this.target) {
            this.current = this.target;
        }
    }
    get() { return Math.round(this.current); }
}

function resetState() {
    state = {
        isRunning: true,
        winnerRevealed: false,
        phase: 'idle',
        participants: new Map(),
        winners: new Map(),
        numberOfParticipants: 0,
        numberOfWinners: 1,
        globalShipImage: 'Ship.png',
        bgOffsetX: -1920,
        bgTargetX: -1920,
        counter: new AnimatedCounter(),
        paused: false,
        laser: null
    };
}

function init(shipImage_, numberOfWinners_) {
    state.globalShipImage = shipImage_;
    state.numberOfWinners = numberOfWinners_;
}

function requestAddParticipant(name, userId, availableNuggets, requestedShipName) {
    if (typeof exclude === 'function' && exclude(name)) return;
    if (!state.isRunning) return;
    if (state.participants.has(name)) return;

    if (availableNuggets >= 1 && requestedShipName !== null && requestedShipName !== undefined) {
        const shipSrc = gameAssets + 'entities/' + requestedShipName + '.png';
        if (imageCache.isLoaded(shipSrc) && imageCache.get(shipSrc)) {
            backend.chargeUser(userId, 1, 'customizing raffle ship', () => {
                addParticipant(name, requestedShipName + '.png');
            });
            return;
        }
        imageCache.load(shipSrc).then(img => {
            if (img) {
                backend.chargeUser(userId, 1, 'customizing raffle ship', () => {
                    addParticipant(name, requestedShipName + '.png');
                });
            } else {
                addParticipantDefault(name);
            }
        });
        return;
    }
    addParticipantDefault(name);
}

function addParticipantDefault(name) {
    if (POD_USERNAMES.split(",").includes(name)) {
        addParticipant(name, "Capsule.png");
    } else {
        addParticipant(name, state.globalShipImage);
    }
}

function addParticipant(name, shipImageFile) {
    const shipSrc = gameAssets + 'entities/' + shipImageFile;
    state.numberOfParticipants++;
    state.counter.set(state.numberOfParticipants);

    const targetX = randomNumber(0, 1620);
    const targetY = randomNumber(0, 780);
    const p = new Participant(name, shipSrc, 1920, targetY, targetX, targetY);
    imageCache.load(shipSrc);
    state.participants.set(name, p);
}

function play() {
    if (state.isRunning && state.winners.size === 0) {
        state.isRunning = false;
        state.phase = 'executing';

        flashOverlay.trigger('white', 0.15, 500);

        for (let i = 0; i < state.numberOfWinners; i++) {
            selectWinner();
        }

        setTimeout(() => {
            state.bgTargetX = 0;

            state.participants.forEach(p => {
                if (p.phase !== AnimPhase.DESTROYED) {
                    p.targetX = p.x + 1920;
                    p.phase = AnimPhase.SLIDING;
                }
            });
            state.winners.forEach(w => {
                w.targetX = w.x + 1920;
                w.phase = AnimPhase.SLIDING;
            });

            setTimeout(() => startBombing(), 2200);
        }, 1000);
    }
}

function selectWinner() {
    const entries = Array.from(state.participants.entries()).filter(([k, v]) => v.alive && !state.winners.has(k));
    if (entries.length === 0) return;
    const [key, winner] = entries[Math.floor(Math.random() * entries.length)];
    state.winners.set(key, winner);
    winner.rank = state.winners.size;
    state.participants.delete(key);
    notifyWinnerCommand('notifyWinner', winner);
}

function startBombing() {
    const participantList = Array.from(state.participants.values()).filter(p => p.alive);
    const animDuration = 10000 / (participantList.length > 100 ? participantList.length / 100 : 1);
    let delay = 0;

    participantList.forEach(p => {
        p.phase = AnimPhase.BOMBING;
        p.bombActive = true;
        p.bombX = -(BOMB_SIZE + randomNumber(100, 300));
        p.bombY = p.y + (SHIP_SIZE - BOMB_SIZE) / 2;
        p.bombTargetX = p.x;
        p.bombProgress = 0;
        p.bombDuration = animDuration / 1000;
        p.bombDelay = delay / 1000;
        p.bombTrail = [];
        delay += randomNumber(50, 150);
    });

    state.winners.forEach(w => {
        w.phase = AnimPhase.WINNER_IDLE;
        w.winnerGlowTime = 0;
    });
}

function handleExplosion(participant) {
    particleSystem.emitBurst(
        participant.x + SHIP_SIZE / 2, participant.y + SHIP_SIZE / 2,
        35, { speed: 250, life: 0.8, r: 255, g: 180, b: 30, size: 5, drag: 0.94, gravity: 100 }
    );
    particleSystem.emitBurst(
        participant.x + SHIP_SIZE / 2, participant.y + SHIP_SIZE / 2,
        15, { speed: 180, life: 0.5, r: 255, g: 255, b: 200, size: 3, drag: 0.92, gravity: 0 }
    );
    screenShake.trigger(4, 300);
    flashOverlay.trigger('white', 0.2, 150);
    audioPool.boom.play();
    notifyWinnerCommand('retractWinner', participant);
}

function revealWinner() {
    if (state.winners.size === 0) return;
    state.phase = 'revealing';

    state.participants.forEach(p => { p.alive = false; p.phase = AnimPhase.DESTROYED; });
    state.participants.clear();

    const verticalSpace = CANVAS_H / (state.winners.size + 1);
    let idx = 1;
    state.winners.forEach(w => {
        w.targetX = WINNER_X;
        w.targetY = verticalSpace * idx - SHIP_SIZE / 2;
        w.phase = AnimPhase.WINNER_IDLE;
        w.winnerGlowTime = 0;
        idx++;
    });

    state.bgTargetX = -1920;

    setTimeout(() => {
        state.winnerRevealed = true;
        state.phase = 'idle';

        state.winners.forEach(w => {
            w.phase = AnimPhase.THREATENED;
            w.bombActive = true;
            w.bombX = -(BOMB_SIZE);
            w.bombY = w.targetY + (SHIP_SIZE - BOMB_SIZE) / 2;
            w.bombTargetX = w.x;
            w.threatProgress = 0;
            w.threatDuration = 60;
            w.bombTrail = [];

            particleSystem.emitBurst(
                w.x + SHIP_SIZE / 2, w.y + SHIP_SIZE / 2,
                25, { speed: 150, life: 1.0, r: 255, g: 215, b: 0, size: 4, drag: 0.96, gravity: 60 }
            );
        });
    }, 2200);
}

function stopWinnerThreat(winner) {
    if (!winner) return;
    state.laser = {
        fromX: winner.x + SHIP_SIZE / 2,
        fromY: winner.y + SHIP_SIZE / 2,
        toX: winner.bombX + BOMB_SIZE / 2,
        toY: winner.bombY + BOMB_SIZE / 2,
        progress: 0,
        duration: 0.7,
        winner: winner,
        done: false
    };
    audioPool.laser.play();
}

function completeLaserHit(winner) {
    particleSystem.emitBurst(
        winner.bombX + BOMB_SIZE / 2, winner.bombY + BOMB_SIZE / 2,
        25, { speed: 200, life: 0.6, r: 150, g: 200, b: 255, size: 4, drag: 0.95, gravity: 50 }
    );
    screenShake.trigger(3, 200);
    flashOverlay.trigger('#aaccff', 0.2, 100);
    audioPool.boom.play();

    winner.bombActive = false;
    winner.phase = AnimPhase.WINNER_IDLE;
    state.winners.delete(winner.name);
    notifyWinnerCommand('confirmWinner', winner);
}

function redraw() {
    if (!state.winnerRevealed) return;

    state.winners.forEach(w => {
        particleSystem.emitBurst(
            w.x + SHIP_SIZE / 2, w.y + SHIP_SIZE / 2,
            15, { speed: 100, life: 0.5, r: 200, g: 200, b: 200, size: 3, drag: 0.95, gravity: 40 }
        );
        w.alive = false;
        w.phase = AnimPhase.DESTROYED;
    });
    state.winners.clear();

    state.numberOfParticipants++;
    state.counter.set(state.numberOfParticipants);

    const entries = Array.from(state.participants.entries()).filter(([k, v]) => v.alive);
    if (entries.length === 0) return;

    selectWinner();
    const newWinner = Array.from(state.winners.values())[0];
    if (!newWinner) return;

    const verticalSpace = CANVAS_H / (state.numberOfWinners + 1);
    newWinner.targetX = WINNER_X - SHIP_SIZE;
    newWinner.targetY = verticalSpace - SHIP_SIZE / 2;
    newWinner.phase = AnimPhase.WINNER_IDLE;
    newWinner.winnerGlowTime = 0;

    state.participants.delete(newWinner.name);
    state.participants.forEach(p => { p.alive = false; p.phase = AnimPhase.DESTROYED; });
    state.participants.clear();

    setTimeout(() => {
        newWinner.phase = AnimPhase.THREATENED;
        newWinner.bombActive = true;
        newWinner.bombX = -(BOMB_SIZE);
        newWinner.bombY = newWinner.targetY + (SHIP_SIZE - BOMB_SIZE) / 2;
        newWinner.bombTargetX = newWinner.x;
        newWinner.threatProgress = 0;
        newWinner.threatDuration = 60;
        newWinner.bombTrail = [];

        particleSystem.emitBurst(
            newWinner.x + SHIP_SIZE / 2, newWinner.y + SHIP_SIZE / 2,
            20, { speed: 150, life: 0.8, r: 255, g: 215, b: 0, size: 4, drag: 0.96, gravity: 60 }
        );
    }, 500);
}

function pause() { state.paused = true; }
function resume() { state.paused = false; }

function onCommandReceived(commandObj) {
    switch (commandObj.cmd) {
        case 'initRaffleBoard':
            init(commandObj.shipPng, commandObj.numberOfWinners);
            break;
        case 'stopRaffleEntries':
            state.isRunning = false;
            break;
        case 'executeRaffle':
            play();
            break;
        case 'revealWinner':
            revealWinner();
            break;
        case 'redraw':
            redraw();
            break;
        case 'pause':
            pause();
            break;
        case 'resume':
            resume();
            break;
        case 'stopWinnerThreat':
            if (state.winners.has(commandObj.winnerName)) {
                stopWinnerThreat(state.winners.get(commandObj.winnerName));
            }
            break;
        case 'addTestParticipant':
            for (let i = 0; i < commandObj.amount; i++) {
                requestAddParticipant('Viewer' + randomNumber(1, 5000), null, 0, null);
            }
            break;
    }
}

function onRaffleEntered(raffleEvent) {
    if (raffleEvent.user) {
        requestAddParticipant(
            raffleEvent.user.displayName,
            raffleEvent.user.id,
            raffleEvent.user.nuggets,
            raffleEvent.raffleArg1 || null
        );
    }
}

function onChatMessageReceived(chatMessageEvent) {
    if (!state.winnerRevealed) return;
    if (!chatMessageEvent.user) return;
    state.winners.forEach((winner) => {
        if (chatMessageEvent.user.displayName === winner.name) {
            stopWinnerThreat(winner);
        }
    });
}

function notifyWinnerCommand(command, winner) {
    send({ cmd: command, name: winner.name, rank: winner.rank });
}

function send(object) {
    backend.sendObject("/app/object", object);
}

let canvas, ctx;
let bgImage = null;
let lastTime = 0;
let globalTime = 0;

function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.style.display = 'block';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
}

function loadBackground() {
    const bgNum = randomNumber(1, 31);
    imageCache.load(gameAssets + 'backgrounds/' + bgNum + '.png').then(img => {
        bgImage = img;
    });
}

function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const shake = screenShake.getOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    if (bgImage) {
        state.bgOffsetX = lerp(state.bgOffsetX, state.bgTargetX, 0.05);
        ctx.drawImage(bgImage, state.bgOffsetX, 0, CANVAS_W, CANVAS_H);
    }

    const allP = [
        ...Array.from(state.participants.values()),
        ...Array.from(state.winners.values())
    ].filter(p => p.alive || p.phase === AnimPhase.EXPLODING);

    for (const p of allP) p.drawShip(ctx, imageCache);
    for (const p of allP) p.drawText(ctx);
    for (const p of allP) p.drawBomb(ctx, imageCache);

    if (state.laser && !state.laser.done) {
        const l = state.laser;
        const endX = lerp(l.fromX, l.toX, l.progress);
        const endY = lerp(l.fromY, l.toY, l.progress);

        ctx.save();
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.4)';
        ctx.lineWidth = 12;
        ctx.shadowColor = 'rgba(100, 180, 255, 0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(l.fromX, l.fromY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(l.fromX, l.fromY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();

        if (l.progress > 0.1) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.shadowColor = 'rgba(150, 200, 255, 0.8)';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(endX, endY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    particleSystem.draw(ctx);
    flashOverlay.draw(ctx);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 6;
    ctx.fillStyle = '#fff';
    ctx.font = '50px "Eve Sans Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.counter.get().toString(), 1850 - state.bgOffsetX, 55);
    ctx.restore();

    if (state.paused) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    globalTime += dt;

    if (!state.paused) {
        screenShake.update(dt);
        flashOverlay.update(dt);
        particleSystem.update(dt);
        state.counter.update(dt);

        state.participants.forEach(p => {
            p.update(dt, globalTime);
            if (p.phase === AnimPhase.EXPLODING && !p.explosionTriggered) {
                p.explosionTriggered = true;
                handleExplosion(p);
            }
        });

        state.winners.forEach(w => {
            w.update(dt, globalTime);
            if (w.phase === AnimPhase.THREATENED && w.threatProgress >= 1) {
                handleExplosion(w);
                state.winners.delete(w.name);
            }
        });

        if (state.laser && !state.laser.done) {
            state.laser.progress += dt / state.laser.duration;
            if (state.laser.progress >= 1) {
                state.laser.progress = 1;
                state.laser.done = true;
                completeLaserHit(state.laser.winner);
                state.laser = null;
            }
        }

        state.participants.forEach((p, key) => {
            if (p.phase === AnimPhase.DESTROYED) state.participants.delete(key);
        });
    }

    render();
    requestAnimationFrame(gameLoop);
}

function onBackendConnect(backend_) {
    backend_.subscribe('/topic/object', onCommandReceived);
    backend_.subscribe('/topic/raffleEntered', onRaffleEntered);
    backend_.subscribe('/topic/chatMessageReceived', onChatMessageReceived);
}

function initModules() {
    imageCache = new ImageCache();
    particleSystem = new ParticleSystem(PARTICLE_POOL_SIZE);
    screenShake = new ScreenShake();
    flashOverlay = new FlashOverlay();
    audioPool = {
        boom: new AudioPool(gameAssets + 'boom.mp3', AUDIO_POOL_SIZE),
        laser: new AudioPool(gameAssets + 'laser.mp3', AUDIO_POOL_SIZE)
    };
}

$(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('game')) {
        gameAssets = 'assets/' + urlParams.get('game') + '/';
    }

    resetState();
    initModules();
    createCanvas();
    loadBackground();

    imageCache.load(gameAssets + 'nuke.png');
    imageCache.load(gameAssets + 'laser.png');
    imageCache.load(gameAssets + 'entities/Ship.png');
    imageCache.load(gameAssets + 'entities/Capsule.png');

    backend = new Backend(onBackendConnect);
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});