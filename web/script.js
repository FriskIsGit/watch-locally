var fluidPlayer = fluidPlayer('player', {
    layoutControls: {
        title: "TITLE PLACEHOLDER",
        doubleclickFullscreen: false,
        subtitlesEnabled: true,
        controlBar: {
            autoHide: true,
            autoHideTimeout: 2.5,
            animated: true,
            playbackRates: ['x2', 'x1.5', 'x1', 'x0.5']
        },
        miniPlayer: {
            enabled: false,
            width: 400,
            height: 225
        }
    }
});

video = document.getElementById("player");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// endpoint should be prefixed with slash
function newPost(endpoint) {
    if (!endpoint.startsWith("/")) {
        endpoint = "/" + endpoint
    }
    let req = new XMLHttpRequest();
    req.open("POST", endpoint, true);
    req.setRequestHeader('Content-Type', 'application/json');
    return req;
}

async function sendAsync(request) {
    request.send(JSON.stringify({
        uuid: "4613443434343",
        timestamp: video.currentTime
    }));
}

function stopButton(fromHtml) {
    let request= newPost("/watch/pause")
    sendAsync(request).then(function(res) {
        console.log("Sending stop ", res);
    });
    if (fromHtml) {
        fluidPlayer.pause();
    }
}

function startButton(fromHtml) {
    let request= newPost("/watch/start")
    sendAsync(request).then(function(res) {
        console.log("Sending start ", res);
    });
    if (fromHtml) {
        fluidPlayer.play();
    }
}

class AtomicBoolean {
    constructor(bool) {
        this.byte = new Int8Array(new SharedArrayBuffer(4));
        Atomics.store(this.byte, 0, bool ? 1 : 0);
    }

    setBoolean(flag) {
        Atomics.store(this.byte, 0, flag ? 1 : 0);
    }

    getBoolean() {
        return Atomics.load(this.byte, 0) === 1;
    }
}

function main() {
    let eventSource = new EventSource("/watch/events");

    let DELTA = 1.5;
    eventSource.addEventListener("start", function (event) {
        let jsonData = JSON.parse(event.data)
        let timestamp = jsonData["timestamp"]
        console.log("Video state: PLAYING, PRIORITY:", jsonData["priority"], "Timestamp:", timestamp);
        let deSync = timestamp - video.currentTime
        console.log("Your deSync: ", deSync)
        if (DELTA < Math.abs(deSync)) {
            console.log("EXCEEDED DELTA=", DELTA, " resyncing!")
            fluidPlayer.skipTo(timestamp)
        }
        fluidPlayer.play()
    })
    eventSource.addEventListener("pause", function (event) {
        let jsonData = JSON.parse(event.data)
        let timestamp = jsonData["timestamp"]
        console.log("Video state: PAUSED, PRIORITY:", jsonData["priority"], "Timestamp:", timestamp);
        let deSync = timestamp - video.currentTime
        console.log("Your deSync: ", deSync)
        if (DELTA < Math.abs(deSync)) {
            console.log("EXCEEDED DELTA=", DELTA, " resyncing!")
            fluidPlayer.skipTo(timestamp)
        }
        fluidPlayer.pause()
    })

    fluidPlayer.on('play', function() {
        startButton(false)
    });

    fluidPlayer.on('pause', function() {
        stopButton(false)
    });

    fluidPlayer.on('seeked', function(){
        console.log("seeked, currentTime", video.currentTime);
        let request= newPost("/watch/seek")
        sendAsync(request).then(function(res) {
            console.log("Sending seek ", res);
        });
    });

    eventSource.onmessage = function(event) {
        console.log("event.data: ", event.lastEventId);
        console.log("event.data: ", event.data);
    };

}


main();