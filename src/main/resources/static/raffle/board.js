let numberOfWinners = 1;
let globalShipImage = 'Ship.png';
let textXOffset = 90;
let textYOffset = 30;
let shipSize = 200;
let bombSize = 150;
let winnerHorizontalPosition = 3500;
let backend;
let gameAssets = 'assets/eve/';
const POD_USERNAMES = "chaos1298,onecrazymonkeh";
const CAM_W = 480;
const CAM_H = 270;

const STAGE_W = 3840;
const STAGE_H = 1080;
const SHADOW_PAD = 30;

let canvas, ctx, overlay;
const nodes = [];
const tweens = [];
const imageCache = new Map();
const shadowCache = new Map();

let state = {};

const EASE = {
    '>': (t) => Math.sin(t * Math.PI / 2),
    '-': (t) => t
};

class Tween {
    constructor(node, dur, delay) {
        this.node = node;
        this.dur = dur;
        this.delay = delay || 0;
        this.easeFn = EASE['-'];
        this.targetX = node._x;
        this.targetY = node._y;
        this.afterCb = null;
        this.startTime = performance.now();
        this.paused = false;
        this.pauseStart = 0;
        this.initialized = false;
        this.finished = false;
    }
    ease(k) { this.easeFn = EASE[k] || EASE['-']; return this; }
    move(x, y) { this.targetX = x; this.targetY = y; return this; }
    after(cb) { this.afterCb = cb; return this; }
    pause() {
        if (this.paused || this.finished) return;
        this.paused = true;
        this.pauseStart = performance.now();
    }
    play() {
        if (!this.paused) return;
        this.paused = false;
        this.startTime += performance.now() - this.pauseStart;
    }
    tick(now) {
        if (this.paused || this.finished) return;
        const elapsed = now - this.startTime;
        if (elapsed < this.delay) return;
        if (!this.initialized) {
            this.fromX = this.node._x;
            this.fromY = this.node._y;
            this.initialized = true;
        }
        const t = Math.min(1, (elapsed - this.delay) / this.dur);
        const e = this.easeFn(t);
        this.node._x = this.fromX + (this.targetX - this.fromX) * e;
        this.node._y = this.fromY + (this.targetY - this.fromY) * e;
        if (t >= 1) {
            this.finished = true;
            if (this.afterCb) this.afterCb();
        }
    }
}

class Node {
    constructor(type) {
        this.type = type;
        this._x = 0; this._y = 0;
        this._w = 0; this._h = 0;
        this._src = null;
        this._text = null;
        this._fontSize = 16;
        this._anchor = 'start';
        this._fill = '#000';
        this._filter = null;
        this._removed = false;
        this._asGif = false;
        this._overlayEl = null;
        this._textCache = null;
        this._textCacheKey = null;
        this._textW = 0;
        this._currentTween = null;
    }
    x() { return this._x; }
    y() { return this._y; }
    move(x, y) { this._x = x; this._y = y; return this; }
    size(w, h) { this._w = w; this._h = h; return this; }
    css(styles) {
        if (styles.filter !== undefined) {
            this._filter = styles.filter === 'none' ? null : styles.filter;
        }
        return this;
    }
    load(src) {
        this._src = src;
        if (/\.gif(\?|$)/i.test(src)) this._asGif = true;
        return this;
    }
    font(arg, val) {
        if (typeof arg === 'object') {
            if (arg.size !== undefined) this._fontSize = arg.size;
            if (arg.anchor !== undefined) this._anchor = arg.anchor;
        } else if (arg === 'size') {
            this._fontSize = val;
        }
        this._textCache = null;
        return this;
    }
    fill(c) { this._fill = c; this._textCache = null; return this; }
    plain(t) { this._text = String(t); this._textCache = null; return this; }
    animate(dur, delay) {
        const tween = new Tween(this, dur, delay);
        tweens.push(tween);
        this._currentTween = tween;
        return tween;
    }
    timeline() { return this._currentTween; }
    remove() {
        this._removed = true;
        if (this._overlayEl) {
            this._overlayEl.remove();
            this._overlayEl = null;
        }
    }
}

const Renderer = {
    image(src) {
        const n = new Node('image');
        n._src = src;
        nodes.push(n);
        return n;
    },
    text(t) {
        const n = new Node('text');
        n._text = String(t);
        nodes.push(n);
        return n;
    }
};

function loadImage(src) {
    let img = imageCache.get(src);
    if (img) return img;
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
    return img;
}

function getShadowedCanvas(src, w, h, filter) {
    const key = src + '|' + w + 'x' + h + '|' + filter;
    let c = shadowCache.get(key);
    if (c) return c;
    const img = loadImage(src);
    if (!img.complete || img.naturalWidth === 0) return null;
    const off = document.createElement('canvas');
    off.width = w + SHADOW_PAD * 2;
    off.height = h + SHADOW_PAD * 2;
    const octx = off.getContext('2d');
    octx.filter = filter;
    octx.drawImage(img, SHADOW_PAD, SHADOW_PAD, w, h);
    shadowCache.set(key, off);
    return off;
}

function drawImageNode(n) {
    if (n._asGif) {
        if (!n._overlayEl) {
            n._overlayEl = document.createElement('img');
            n._overlayEl.style.position = 'absolute';
            n._overlayEl.style.pointerEvents = 'none';
            overlay.appendChild(n._overlayEl);
        }
        if (n._overlayEl.getAttribute('data-src') !== n._src) {
            n._overlayEl.setAttribute('data-src', n._src);
            n._overlayEl.src = n._src;
        }
        n._overlayEl.style.left = (n._x / STAGE_W * 100) + '%';
        n._overlayEl.style.top = (n._y / STAGE_H * 100) + '%';
        n._overlayEl.style.width = (n._w / STAGE_W * 100) + '%';
        n._overlayEl.style.height = (n._h / STAGE_H * 100) + '%';
        return;
    }
    if (!n._filter) {
        const img = loadImage(n._src);
        if (!img.complete || img.naturalWidth === 0) return;
        ctx.drawImage(img, n._x, n._y, n._w, n._h);
        return;
    }
    const baked = getShadowedCanvas(n._src, n._w, n._h, n._filter);
    if (!baked) return;
    ctx.drawImage(baked, n._x - SHADOW_PAD, n._y - SHADOW_PAD);
}

const textMeasureCtx = document.createElement('canvas').getContext('2d');

function drawTextNode(n) {
    const key = n._text + '|' + n._fontSize + '|' + n._fill + '|' + (n._filter || '');
    if (n._textCacheKey !== key || !n._textCache) {
        const fontStr = n._fontSize + 'px "Eve Sans Neue", sans-serif';
        textMeasureCtx.font = fontStr;
        const width = Math.max(1, Math.ceil(textMeasureCtx.measureText(n._text).width));
        const height = Math.ceil(n._fontSize * 1.3);
        const off = document.createElement('canvas');
        off.width = width + SHADOW_PAD * 2;
        off.height = height + SHADOW_PAD * 2;
        const octx = off.getContext('2d');
        octx.font = fontStr;
        octx.fillStyle = n._fill;
        octx.textBaseline = 'top';
        if (n._filter) octx.filter = n._filter;
        octx.fillText(n._text, SHADOW_PAD, SHADOW_PAD);
        n._textCache = off;
        n._textCacheKey = key;
        n._textW = width;
    }
    let dx = n._x - SHADOW_PAD;
    if (n._anchor === 'middle') dx = n._x - n._textW / 2 - SHADOW_PAD;
    else if (n._anchor === 'end') dx = n._x - n._textW - SHADOW_PAD;
    ctx.drawImage(n._textCache, dx, n._y - SHADOW_PAD);
}

function renderFrame() {
    const now = performance.now();
    for (let i = 0; i < tweens.length; i++) tweens[i].tick(now);
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].finished) tweens.splice(i, 1);
    for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i]._removed) nodes.splice(i, 1);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.type === 'image') drawImageNode(n);
        else drawTextNode(n);
    }
    requestAnimationFrame(renderFrame);
}

var resetState = function () {
    if (state.draw) {
        nodes.length = 0;
        tweens.length = 0;
        overlay.innerHTML = '';
    }
    state.winners = new Map();
    state.draw = null;
    state.background = null;
    state.participants = new Map();
    state.isRunning = true;
    state.winnerRevealed = false;
    state.numberOfParticipantsText = null;
    state.numberOfParticipants = 0;
};

var init = function (shipImage_, numberOfWinners_) {
    globalShipImage = shipImage_;
    numberOfWinners = numberOfWinners_;
};

var launch = function () {
    resetState();
    state.draw = Renderer;
    state.background = state.draw.image(gameAssets + 'backgrounds/' + randomNumber(1, 31) + '.png').size(3840, 1080).move(-1920, 0);
    state.numberOfParticipantsText = state.draw.text(state.numberOfParticipants).font({
        size: 50
        , anchor: 'middle'
        , leading: '1.5em'
    }).fill('#fff').css({filter: 'drop-shadow(6px 0px 7px rgba(0, 0, 0, 0.5))'}).move(1850, 20);
};

var requestAddParticipant = function (name, userId, availableNuggets, requestedShipName) {
    if(exclude(name)) return;
    if (state.isRunning && !state.participants.has(name)) {
        if (availableNuggets >= 1 && requestedShipName !== null && fileExists(gameAssets + '/entities/' + requestedShipName + '.png')) {
            const img = loadImage(gameAssets + 'entities/' + requestedShipName + '.png');
            const ready = () => backend.chargeUser(userId, 1, 'customizing raffle ship',
                    () => {
                addParticipant(name, requestedShipName + '.png');
            });
            if (img.complete && img.naturalWidth > 0) ready();
            else img.addEventListener('load', ready, { once: true });
        } else {
            if (!POD_USERNAMES.split(",").includes(name)) {
                addParticipant(name, globalShipImage);
            } else {
                addParticipant(name, "Capsule.png");
            }
        }
    }
};

var fileExists = function (fileURI) {
    var http = new XMLHttpRequest();

    http.open('HEAD', fileURI, false);
    http.send();

    return http.status !== 404;
};

var addParticipant = function (name, shipImage) {
    state.numberOfParticipants++;
    let randomX, randomY;
    do {
        randomX = randomNumber(0, 1620);
        randomY = randomNumber(0, 780);
    } while (randomX < CAM_W && randomY + shipSize > 1080 - CAM_H);
    let participant = createParticipant(name, randomX, randomY, shipImage);
    state.participants.set(name, participant);
    participant.ship.animate(6000, 0, 'now').ease('>').move(randomX, randomY);
    participant.text.animate(6000, 0, 'now').ease('>').move(randomX + textXOffset, randomY + textYOffset);
    state.numberOfParticipantsText.plain(state.numberOfParticipants);
};

var createParticipant = function (name, x, y, shipImage) {
    return {
        name: name,
        shipImage: shipImage,
        ship: state.draw.image(gameAssets + 'entities/' + shipImage).css({filter: 'drop-shadow(12px 0px 7px rgba(200, 200, 200, 0.5))'}).size(shipSize, shipSize).move(1920, y),
        text: state.draw.text(name).fill('#fff').font('size', 30).css({filter: 'drop-shadow(3px 3px 1px rgba(0, 0, 0, 1.0))'}).move(1920 + textXOffset, y + textYOffset),
        bomb: state.draw.image(gameAssets + 'nuke.png').css({filter: 'drop-shadow(-12px 0px 7px rgba(200, 150, 150, 0.5))'}).size(bombSize, bombSize).move(-(x + bombSize), y + (shipSize - bombSize) / 2)
    };
};

var play = function () {
    if (!state.isRunning && state.winners.size === 0) {
        state.background.animate(2000, 0, 'now').ease('>').move(0, 0);
        state.participants.forEach((participant) => {
            participant.ship.animate(2000, 0, 'now').ease('>').move(participant.ship.x() + 1920, participant.ship.y());
            participant.text.animate(2000, 0, 'now').ease('>').move(participant.text.x() + 1920, participant.text.y());
        });

        for (i = 0; i < numberOfWinners; i++) {
            selectWinner();
        }

        let delay = 0;
        let animationDuration = 10000 / (state.participants.size > 100 ? state.participants.size / 100 : 1);
        state.participants.forEach((participant) => {
            participant.ship.animate(animationDuration, 2000 + delay, 'now').ease('-').move(participant.ship.x(), participant.ship.y()).after(() => ((participant) => {
                    explode(participant);
                })(participant));
            participant.bomb.animate(animationDuration, 2000 + delay, 'now').ease('-').move(participant.ship.x(), participant.bomb.y());
            participant.text.animate(animationDuration, 2000 + delay, 'now').ease('-').move(participant.ship.x() + textXOffset, participant.text.y());
            delay += randomNumber(50, 150);
        });
    }
};

var selectWinner = function () {
    currentRandomWinner = Array.from(state.participants.entries())[Math.floor(Math.random() * state.participants.size)][1];
    state.winners.set(currentRandomWinner.name, currentRandomWinner);
    currentRandomWinner.rank = state.winners.size;
    state.participants.delete(currentRandomWinner.name);
    notifyWinnerCommand('notifyWinner', currentRandomWinner);
};

var revealWinner = function () {
    if (state.winners.size > 0) {
        state.participants.forEach((participant) => {
            participant.ship.remove();
            participant.bomb.remove();
        });

        let verticalSpaceBetweenShips = 1080 / (state.winners.size + 1);
        let winnerIndex = 1;
        state.winners.forEach((winner) => {
            winner.ship.move(winnerHorizontalPosition, verticalSpaceBetweenShips * winnerIndex - shipSize / 2);
            winner.text.move(winnerHorizontalPosition + textXOffset, verticalSpaceBetweenShips * winnerIndex - shipSize / 2 + textYOffset);

            state.background.animate(2000, 0, 'now').ease('>').move(-1920, 0);
            winner.ship.animate(2000, 0, 'now').ease('>').move(winner.ship.x() - 1920, winner.ship.y());
            winner.text.animate(2000, 0, 'now').ease('>').move(winner.text.x() - 1920, winner.text.y()).after(() => {
                state.winnerRevealed = true;
                winner.bomb.move(-bombSize, winner.ship.y() + (shipSize - bombSize) / 2);
                winner.bomb.animate(60000, 3000, 'now').ease('-').move(winner.ship.x(), winner.bomb.y()).after(() => ((winner) => {
                        explode(winner);
                    })(winner));
            });
            winnerIndex++;
        });
    }
};

var redraw = function () {
    if (state.winnerRevealed) {
        state.winners.clear();
        state.numberOfParticipants++;
        state.numberOfParticipantsText.plain(state.numberOfParticipants);
        selectWinner();
        winnerHorizontalPosition -= shipSize;
        state.winners.forEach((winner) => {
            state.winners.set(winner.name, createParticipant(winner.name, 0, 0, 'Capsule.png'));
        });
        revealWinner();
    }
};

var stopWinnerThreat = function (winner) {
    notifyWinnerCommand('confirmWinner', winner);
    let laser = state.draw.image(gameAssets + 'laser.png').css({filter: 'drop-shadow(12px 0px 7px rgba(200, 100, 50, 0.5))'}).size(150, 150).move(winner.ship.x(), winner.ship.y() + (shipSize - bombSize) / 2);
    let audioLaser = new Audio(gameAssets + 'laser.mp3');
    audioLaser.loop = false;
    audioLaser.volume = 0.3;
    audioLaser.play();
    laser.animate(700, 0, 'now').ease('-').move(winner.bomb.x(), winner.bomb.y()).after(() => {
        winner.bomb.timeline().pause();
        winner.bomb.css({filter: 'none'}).load(gameAssets + 'giphy.gif?i=' + uuidv4());
        let audioBoom = new Audio(gameAssets + 'boom.mp3');
        audioBoom.loop = false;
        audioBoom.volume = 0.3;
        audioBoom.play();
        laser.remove();
        state.winners.delete(winner.name);
    });
};

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
            .replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0,
                        v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
}

function notifyWinnerCommand(command, winner) {
    send({
        cmd: command,
        name: winner.name,
        rank: winner.rank
    });
};

var explode = function (participant) {
    state.winners.delete(participant.name);
    notifyWinnerCommand('retractWinner', participant);
    let audioBoom = new Audio(gameAssets + 'boom.mp3');
    audioBoom.loop = false;
    audioBoom.volume = 0.3;
    audioBoom.play();
    participant.ship.css({filter: 'none'}).load(gameAssets + 'giphy.gif?i=' + uuidv4());
    participant.bomb.css({filter: 'none'}).load(gameAssets + 'giphy.gif?i=' + uuidv4());
    participant.text.remove();
    state.numberOfParticipants--;
    state.numberOfParticipantsText.plain(state.numberOfParticipants);
    setTimeout(() => {
        participant.ship.remove();
        participant.bomb.remove();
    }, 1500);
};

var pause = function() {
    if (!state.winnerRevealed) return;
    state.winners.forEach((winner) => {
        winner.bomb.timeline().pause();
    });
};

var resume = function() {
    if (!state.winnerRevealed) return;
    state.winners.forEach((winner) => {
        winner.bomb.timeline().play();
    });
};

var randomNumber = function (min, max) {
    return Math.round(Math.random() * (max - min) + min);
};

function onCommandReceived(commandObj) {
    if (commandObj.cmd === 'initRaffleBoard') {
        init(commandObj.shipPng, commandObj.numberOfWinners);
    }
    if (commandObj.cmd === 'stopRaffleEntries') {
        state.isRunning = false;
    }
    if (commandObj.cmd === 'executeRaffle') {
        play();
    }
    if (commandObj.cmd === 'revealWinner') {
        revealWinner();
    }
    if (commandObj.cmd === 'redraw') {
        redraw();
    }
    if (commandObj.cmd === 'pause') {
        pause();
    }
    if (commandObj.cmd === 'resume') {
        resume();
    }
    if (commandObj.cmd === 'stopWinnerThreat') {
        if (state.winners.has(commandObj.winnerName)) {
            stopWinnerThreat(state.winners.get(commandObj.winnerName));
        }
    }
    if (commandObj.cmd === 'addTestParticipant') {
        for (i = 0; i < commandObj.amount; i++) {
            requestAddParticipant('Viewer' + randomNumber(1, 5000), null, 0, null);
        }
    }
}

function onRaffleEntered(raffleEvent) {
    requestAddParticipant(raffleEvent.user.displayName, raffleEvent.user.id, raffleEvent.user.nuggets, raffleEvent.raffleArg1);
}

function onChatMessageReceived(chatMessageEvent) {
    if (!state.winnerRevealed) {
        return;
    }
    state.winners.forEach((winner) => {
        if (chatMessageEvent.user.displayName === winner.name) {
            stopWinnerThreat(winner);
        }
    });
}

function send(object) {
    backend.sendObject("/app/object", object);
}

function onBackendConnect(backend) {
    backend.subscribe('/topic/object', onCommandReceived);
    backend.subscribe('/topic/raffleEntered', onRaffleEntered);
    backend.subscribe('/topic/chatMessageReceived', onChatMessageReceived);
}

$(() => {
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    overlay = document.getElementById('overlay');
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('game')) {
        gameAssets = 'assets/' + urlParams.get('game') + '/';
    }
    backend = new Backend(onBackendConnect);
    launch();
    requestAnimationFrame(renderFrame);
});
