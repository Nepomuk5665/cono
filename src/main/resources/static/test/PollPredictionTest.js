function onPollEventReceived(event) {
    console.log(event);
}

function onPredictionEventReceived(event) {
    console.log(event);
}

function onBackendConnect(backend) {
    backend.subscribe('/topic/channelPollReceived', onPollEventReceived);
    backend.subscribe('/topic/channelPredictionReceived', onPredictionEventReceived);
}

$(() => {
    backend = new Backend(onBackendConnect);
});