let currentId = null;

function onBackendConnect(backend) {
    backend.subscribe('/topic/channelPredictionReceived', onPredictionEvent);
    backend.subscribe('/topic/object', onObjectReceived);
}

$(() => { new Backend(onBackendConnect); });

function onObjectReceived(msg) {
    if (!msg || !msg.cmd) return;
    if (msg.cmd === 'testPrediction') onPredictionEvent(msg.payload);
    if (msg.cmd === 'hidePrediction' && window.PredictionPanel) window.PredictionPanel.hide();
}

function onPredictionEvent(event) {
    if (!event || !window.PredictionPanel) return;

    switch (event.eventType) {
        case 'START':
            currentId = event.id;
            window.PredictionPanel.onStart(event);
            break;
        case 'PROGRESS':
            if (currentId !== event.id) {
                currentId = event.id;
                window.PredictionPanel.onStart(event);
            } else {
                window.PredictionPanel.onProgress(event);
            }
            break;
        case 'LOCKED':
            if (currentId !== event.id) currentId = event.id;
            window.PredictionPanel.onLocked(event);
            break;
        case 'END':
            if (currentId !== event.id) currentId = event.id;
            window.PredictionPanel.onEnd(event);
            currentId = null;
            break;
    }
}
