export { Player, Options };

class Player {
    constructor(videoElement, options) {
        if (!videoElement || videoElement.tagName.toLowerCase() !== "video") {
            throw new Error("An invalid video element was passed!");
        }

        if (!(options instanceof Options) || !options.valid()) {
            options = new Options();
        }
        this.internals = new Internals(videoElement, options);
    }

    isPlaying() {
        return this.internals.isVideoPlaying();
    }

    play() {
        this.internals.play();
    }

    pause() {
        this.internals.pause();
    }

    seek(timestamp) {
        this.internals.seek(timestamp);
    }

    setVolume(volume) {
        this.internals.setVolume(volume);
    }

    setTitle(title) {
        this.internals.setTitle(title);
    }

    setToast(toast) {
        this.internals.setToast(toast);
    }

    getLoop() {
        return this.internals.loopEnabled;
    }

    setLoop(enabled) {
        this.internals.setLoop(enabled);
    }

    setAutoplay(enabled) {
        this.internals.setAutoplay(enabled);
    }

    getAutoplay() {
        return this.internals.autoplayEnabled;
    }

    getCurrentTime() {
        return this.internals.htmlVideo.currentTime;
    }

    // Adds a new subtitle track in the 'showing' mode, hiding the previous track. Returns the index of the new track.
    setSubtitleTrack(subtitleUrl) {
        this.internals.addSubtitleTrack(subtitleUrl, true);
    }

    // Adds a new subtitle track in the 'hidden' mode. Returns the index of the new track.
    addSubtitleTrack(subtitleUrl) {
        return this.internals.addSubtitleTrack(subtitleUrl, false);
    }

    // Disables and removes the track at the specified index.
    removeSubtitleTrackAt(index) {
        this.internals.removeSubtitleTrackAt(index);
    }

    // Hides the previously selected track. Shows the track at the specified index.
    enableSubtitleTrack(index) {
        this.internals.enableSubtitleTrack(index);
    }

    // The seconds argument is a double, negative shifts back, positive shifts forward
    shiftCurrentSubtitleTrackBy(seconds) {
        return this.internals.shiftCurrentSubtitleTrackBy(seconds)
    }

    destroyPlayer() {}

    onControlsPlay(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsPlay = func;
    }

    onControlsPause(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsPause = func;
    }

    onControlsNext(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsNext = func;
    }

    onControlsLoop(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsLoop = func;
    }

    onControlsAutoplay(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsAutoplay = func;
    }

    onControlsSeeking(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsSeeking = func;
    }

    onControlsSeeked(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsSeeked = func;
    }

    onControlsVolumeSet(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsVolumeSet = func;
    }

    onPlaybackError(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.firePlaybackError = func;
    }

    onPlaybackEnd(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.firePlaybackEnd = func;
    }

    onSubtitleTrackLoad(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireSubtitleTrackLoad = func;
    }

    setVideoTrack(url) {
        this.internals.setVideoTrack(url);
    }
}

function hideElement(element) {
    element.style.display = "none";
}

class Internals {
    constructor(videoElement, options) {
        this.isMobile = isMobileAgent();
        this.options = options;

        this.hls = null;
        this.playingHls = false;

        this.loopEnabled = false;
        this.autoplayEnabled = false;

        this.htmlVideo = videoElement;
        this.htmlVideo.disablePictureInPicture = true;
        this.htmlVideo.controls = false;

        // Div container where either the player or the placeholder resides.
        this.htmlPlayerRoot = newDiv("player_container");

        // We actually need to append the <div> to document.body (or <video>'s parent)
        // otherwise the <video> tag will disappear entirely!
        let videoParent = this.htmlVideo.parentNode;
        videoParent.appendChild(this.htmlPlayerRoot);
        this.htmlPlayerRoot.appendChild(this.htmlVideo);

        this.htmlTitleContainer = newDiv("player_title_container");
        hideElement(this.htmlTitleContainer);
        this.htmlPlayerRoot.appendChild(this.htmlTitleContainer);
        this.htmlTitle = document.createElement("span");
        this.htmlTitle.id = "player_title_text";
        this.htmlTitleContainer.appendChild(this.htmlTitle);

        this.htmlToastContainer = newDiv("player_toast_container");
        hideElement(this.htmlToastContainer);
        this.htmlPlayerRoot.appendChild(this.htmlToastContainer);
        this.htmlToast = document.createElement("span");
        this.htmlToast.id = "player_toast_text";
        this.htmlToastContainer.appendChild(this.htmlToast);

        this.htmlBuffering = newImg("player_buffering");
        this.htmlBuffering.src = "svg/buffering.svg";
        hideElement(this.htmlBuffering);
        this.htmlBuffering.setAttribute("class", "unselectable");
        this.htmlPlayerRoot.appendChild(this.htmlBuffering);

        this.htmlPlayTogglePopup = newImg("player_playtoggle_popup");
        this.htmlPlayTogglePopup.src = "svg/play_popup.svg";
        this.htmlPlayTogglePopup.setAttribute("class", "unselectable");
        this.htmlPlayerRoot.appendChild(this.htmlPlayTogglePopup);

        this.htmlControls = {
            root: newDiv("player_controls"),
            progress: {
                root:      newDiv("player_progress_root"),
                current:   newDiv("player_progress_current"),
                buffered:  newElement("canvas", "player_progress_buffered"),
                total:     newDiv("player_progress_total"),
                thumb:     newDiv("player_progress_thumb"),
                popupRoot: newDiv("player_progress_popup_root"),
                popupText: newDiv("player_progress_popup_text"),
            },

            playToggleButton: newDiv("player_play_toggle"),
            nextButton:       newDiv("player_next"),
            loopButton:       newDiv("player_loop"),
            volume:           newDiv("player_volume"),
            volumeSlider:     newElement("input", "player_volume_slider"),
            timestamp:        newElement("span", "player_timestamp"),
            download:         newDiv("player_download"),
            autoplay:         newDiv("player_autoplay"),
            subs:             newDiv("player_subs"),
            settings:         newDiv("player_settings"),
            fullscreen:       newDiv( "player_fullscreen"),

            subMenu: {
                root: newDiv("player_submenu_root"),

                selected: {
                    button: null,
                    bottom: null,
                    track:  null,
                },

                top: {
                    selectButton:  newDiv("player_submenu_select_button"),
                    searchButton:  newDiv("player_submenu_search_button"),
                    optionsButton: newDiv("player_submenu_options_button"),
                },

                bottom: {
                    selectRoot:  newDiv("player_submenu_bottom_select"),
                    searchRoot:  newDiv("player_submenu_bottom_search"),
                    optionsRoot: newDiv("player_submenu_bottom_options"),
                },

                /// Part of the bottom selection panel, html track elements are appended here.
                trackList: newDiv("subtitle_track_list"),
            }
        };

        // We could store references to images/svg/videos here for easy access
        this.resources = {
            seekForwardImg: "svg/seek10.svg",
            seekBackwardImg: "svg/seek10.svg",
            playImg: "svg/play.svg",
            pauseImg: "svg/pause.svg",
            nextImg: "svg/next.svg",
            loopImg: "svg/loop.svg",
            volumeFullImg: "svg/volume_full.svg",
            volumeMediumImg: "svg/volume_medium.svg",
            volumeLowImg: "svg/volume_low.svg",
            volumeMutedImg: "svg/volume_muted.svg",
            downloadImg: "svg/download.svg",
            autoplayImg: "svg/autoplay.svg",
            subsImg: "svg/subs.svg",
            settingsImg: "svg/settings.svg",
            fullscreenImg: "svg/fullscreen.svg",
            fullscreenExitImg: "svg/fullscreen_exit.svg",
        };

        this.htmlImgs = {
            seekForward: null,
            seekBackward: null,
            playToggle: null,
            next: null,
            volume: null,
            download: null,
            autoplay: null,
            subs: null,
            settings: null,
            fullscreen: null,
        };

        this.isDraggingProgressBar = false;
        this.isHoveringProgressBar = false;
        this.volumeBeforeMute = 0.0;
        this.selectedSubtitleIndex = -1;

        this.initializeImageSources();

        this.htmlSeekForward = newDiv("player_forward_container");
        this.htmlSeekForward.appendChild(this.htmlImgs.seekForward);
        this.htmlPlayerRoot.appendChild(this.htmlSeekForward);

        this.htmlSeekBackward = newDiv("player_backward_container");
        this.htmlSeekBackward.appendChild(this.htmlImgs.seekBackward);
        this.htmlPlayerRoot.appendChild(this.htmlSeekBackward);

        this.createHtmlControls();
        this.createSubtitleMenu();

        this.attachHtmlEvents();
        this.setProgressMargin(5);
        setInterval(() => this.redrawBufferedBars(), this.options.bufferingRedrawInterval);
    }

    fireControlsPlay() {}
    fireControlsPause() {}
    fireControlsNext() {}
    fireControlsLoop(_enabled) {}
    fireControlsAutoplay(_enabled) {}
    fireControlsSeeking(_timestamp) {}
    fireControlsSeeked(_timestamp) {}
    fireControlsVolumeSet(_volume) {}
    firePlaybackError(_event) {}
    firePlaybackEnd() {}
    fireSubtitleTrackLoad(_event) {}


    isVideoPlaying() {
        return !this.htmlVideo.paused && !this.htmlVideo.ended;
    }

    play() {
        if (this.isVideoPlaying()) {
            return;
        }

        this.htmlPlayTogglePopup.src = "svg/play_popup.svg";
        this.htmlPlayTogglePopup.classList.add("animate");
        this.htmlImgs.playToggle.src = this.resources.pauseImg;
        this.htmlVideo.play().catch(e => {
            this.firePlaybackError(e);
        });
    }

    pause() {
        if (!this.isVideoPlaying()) {
            return;
        }

        this.htmlPlayTogglePopup.src = "svg/pause_popup.svg";
        this.htmlPlayTogglePopup.classList.add("animate");
        this.htmlImgs.playToggle.src = this.resources.playImg;
        this.htmlVideo.pause();
    }

    seek(timestamp) {
        if (isNaN(timestamp)) {
            return
        }
        this.htmlVideo.currentTime = timestamp;
    }

    updateProgressBar(progress) {
        this.htmlControls.progress.current.style.width = progress * 100 + "%"

        const width = this.htmlControls.progress.root.clientWidth;
        let thumb_left = width * progress;
        thumb_left -= this.htmlControls.progress.thumb.offsetWidth / 2.0;
        this.htmlControls.progress.thumb.style.left = thumb_left + "px";
    }

    setProgressMargin(marginSize) {
        let margin = marginSize + "px";

        let totalStyle = this.htmlControls.progress.total.style;
        let currentStyle = this.htmlControls.progress.current.style;
        let bufferedStyle = this.htmlControls.progress.buffered.style;

        totalStyle.marginTop = margin;
        currentStyle.marginTop = margin;
        bufferedStyle.marginTop = margin;

        totalStyle.marginBottom = margin;
        currentStyle.marginBottom = margin;
        bufferedStyle.marginBottom = margin;

        let rootHeight = this.htmlControls.progress.root.clientHeight;
        let height = (rootHeight - marginSize * 2.0) + "px";
        totalStyle.height = height;
        currentStyle.height = height;
        bufferedStyle.height = height;
    }

    updateTimestamps(timestamp) {
        let duration = 0.0;
        let position = 0.0;

        if (!isNaN(this.htmlVideo.duration) && this.htmlVideo.duration !== 0.0) {
            duration = this.htmlVideo.duration;
            position = timestamp / duration;
        }

        if (!this.isDraggingProgressBar) {
            this.updateProgressBar(position);
        }

        let current_string = createTimestampString(this.htmlVideo.currentTime);
        // NOTE(kihau): This duration string does not need to be updated every time since the duration does not change?
        let duration_string = createTimestampString(duration);

        this.htmlControls.timestamp.textContent = current_string + " / " + duration_string;
    }

    updateHtmlVolume(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        if (volume == 0.0) {
            this.htmlImgs.volume.src = this.resources.volumeMutedImg;
        } else if (volume < 0.3) {
            this.htmlImgs.volume.src = this.resources.volumeLowImg;
        } else if (volume < 0.6) {
            this.htmlImgs.volume.src = this.resources.volumeMediumImg;
        } else {
            this.htmlImgs.volume.src = this.resources.volumeFullImg;
        }

        this.htmlControls.volumeSlider.value = volume;
    }

    getNewTime(timeOffset) {
        let timestamp = this.htmlVideo.currentTime + timeOffset;
        if (timestamp < 0) {
            timestamp = 0;
        }
        return timestamp;
    }

    setVolume(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        this.htmlVideo.volume = volume;
        this.updateHtmlVolume(volume);
    }

    // TODO(kihau): Non linear scaling?
    setVolumeRelative(volume) {
        this.setVolume(this.htmlVideo.volume + volume);
    }

    setTitle(title) {
        if (!title) {
            hideElement(this.htmlTitleContainer);
        } else {
            this.htmlTitleContainer.style.display = "";
            this.htmlTitle.textContent = title;
        }
    }

    setToast(toast) {
        this.htmlToast.textContent = toast;
        this.htmlToastContainer.classList.remove("player_fade_out");
        this.htmlToastContainer.style.display = "flex";

        clearTimeout(this.playerHideToastTimeoutId);
        this.playerHideToastTimeoutId = setTimeout(() => {
            this.htmlToastContainer.classList.add("player_fade_out");
        }, 3000);
    }

    setLoop(enabled) {
        this.loopEnabled = enabled;

        // NOTE(kihau): Temporary goofyness for testing
        if (this.loopEnabled) {
            this.htmlImgs.loop.style.filter = "invert(19%) sepia(80%) saturate(4866%) hue-rotate(354deg) brightness(106%) contrast(127%)";
        } else {
            this.htmlImgs.loop.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";
        }
    }

    setAutoplay(enabled) {
        this.autoplayEnabled = enabled;

        // NOTE(kihau): Temporary goofyness for testing
        if (this.autoplayEnabled) {
            this.htmlImgs.autoplay.style.filter = "invert(19%) sepia(80%) saturate(4866%) hue-rotate(354deg) brightness(106%) contrast(127%)";
        } else {
            this.htmlImgs.autoplay.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";
        }
    }

    togglePlay() {
        if (this.htmlVideo.paused) {
            this.fireControlsPlay();
            this.play();
        } else {
            this.fireControlsPause();
            this.pause();
        }
    }

    setVideoTrack(url) {
        if(URL.canParse && !URL.canParse(url, document.baseURI)){
            console.debug("Failed to set a new URL. It's not parsable.")
            // We should probably inform the user about the error either via debug log or return false
            return
        }
        // This covers both relative and fully qualified URLs because we always specify the base
        // and when the base is not provided, the second argument is used to construct a valid URL
        let pathname = new URL(url, document.baseURI).pathname;

        this.seek(0);

        if (pathname.endsWith(".m3u8") || pathname.endsWith(".ts")) {
            import("../external/hls.js").then(module => {
                if (module.Hls.isSupported()) {
                    if (this.hls == null) {
                        this.hls = new module.Hls({
                            // If these controllers are used, they'll clear tracks or cues when HLS is attached/detached.
                            // HLS does not provide a way to make it optional, therefore we don't want HLS to mess with
                            // our subtitle tracks, handling it would require hacky solutions or modifying HLS source code
                            timelineController: null,
                            subtitleTrackController: null,
                            subtitleStreamController: null,
                        });
                    }

                    this.hls.loadSource(url);
                    this.hls.attachMedia(this.htmlVideo);
                    this.playingHls = true;
                }
            });
        } else {
            if (this.playingHls) {
                this.hls.detachMedia();
                this.playingHls = false;
            }
            this.htmlVideo.src = url;
            this.htmlVideo.load();
        }
    }

    addSubtitleTrack(url, show) {
        let filename = url.substring(url.lastIndexOf("/") + 1);
        let extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        if (extension != "vtt" && extension != "srt") {
            console.debug("Unsupported subtitle extension:", extension)
            return
        }

        let track = document.createElement("track")
        track.label = filename
        track.kind = "subtitles"
        track.src = url

        // This will cause a new text track to appear in video.textTracks even if it's invalid
        this.htmlVideo.appendChild(track)

        let textTracks = this.htmlVideo.textTracks;
        let newIndex = textTracks.length - 1;
        let newTrack = textTracks[newIndex];

        if (show) {
            let previous = this.selectedSubtitleIndex;
            if (0 <= previous && previous < textTracks.length) {
                textTracks[previous].mode = "hidden";
            }
            this.selectedSubtitleIndex = newIndex;
            newTrack.mode = "showing";
        } else {
            // By default, every track is appended in the 'disabled' mode which prevents any initialization
            newTrack.mode = "hidden";
        }

        // Although we cannot access cues immediately here (not loaded yet)
        // we do have access to the textTrack so it's possible to change its mode
        track.addEventListener("load", (event) => {
            this.fireSubtitleTrackLoad(event);
            console.info("Text track loaded successfully", event.target)

            let trackList = this.htmlControls.subMenu.trackList;
            let htmlTrack = this.createSubtitleTrackElement(filename);
            trackList.appendChild(htmlTrack);
        });
        return newIndex
    }

    enableSubtitleTrack(index) {
        let textTracks = this.htmlVideo.textTracks;
        let current = this.selectedSubtitleIndex;
        if (0 <= current && current < textTracks.length) {
            textTracks[current].mode = "hidden";
        }
        if (0 <= index && index < textTracks.length) {
            textTracks[index].mode = "showing";
            this.selectedSubtitleIndex = index;
        }
    }

    toggleCurrentTrackVisibility() {
        let textTracks = this.htmlVideo.textTracks;
        let index = this.selectedSubtitleIndex;

        if (index < 0 || index >= textTracks.length) {
            return;
        }
        let isShowing = textTracks[index].mode === "showing";
        if (isShowing) {
            textTracks[index].mode = "hidden";
        } else {
            textTracks[index].mode = "showing";
        }
    }

    // Returns the number of cues shifted, it's possible to call this method when the cues are not yet loaded returning 0
    shiftCurrentSubtitleTrackBy(seconds) {
        let index = this.selectedSubtitleIndex;
        let textTracks = this.htmlVideo.textTracks;
        if (index < 0 || index >= textTracks.length) {
            return 0;
        }

        let track = textTracks[index];
        let shifted = 0;
        let cues = track.cues;
        for (let i = 0; i < cues.length; i++) {
            // Cannot assign cue[i] to a variable or an arbitrary number of cues may be shifted
            cues[i].startTime += seconds;
            cues[i].endTime += seconds;
            shifted++;
        }
        return shifted;
    }

    removeSubtitleTrackAt(index) {
        let textTracks = this.htmlVideo.textTracks;
        if (index < 0 || index >= textTracks.length) {
            return;
        }
        textTracks[index].mode = "disabled";
        let tracks = this.htmlVideo.getElementsByTagName("track");
        this.htmlVideo.removeChild(tracks[index]);
        // Index-tracking mechanism
        if (index < this.selectedSubtitleIndex) {
            this.selectedSubtitleIndex--;
        }
    }

    showPlayerUI() {
        this.htmlVideo.style.cursor = "auto";
        this.htmlControls.root.classList.remove("player_fade_out");
        this.htmlControls.root.classList.add("player_fade_in");

        this.htmlTitleContainer.classList.remove("player_fade_out");
        this.htmlTitleContainer.classList.add("player_fade_in");
    }

    hidePlayerUI() {
        if (this.options.disableControlsAutoHide || !this.isVideoPlaying()) {
            return;
        }

        this.htmlVideo.style.cursor = "none";
        this.htmlControls.root.classList.remove("player_fade_in");
        this.htmlControls.root.classList.add("player_fade_out");

        this.htmlTitleContainer.classList.remove("player_fade_in");
        this.htmlTitleContainer.classList.add("player_fade_out");
    }

    resetPlayerUIHideTimeout() {
        clearTimeout(this.playerUIHideTimeoutID);
        this.playerUIHideTimeoutID = setTimeout(() => {
            this.hidePlayerUI();
        }, this.options.inactivityTime);
    }

    redrawBufferedBars() {
        const context = this.htmlControls.progress.buffered.getContext("2d");
        context.fillStyle = "rgb(204, 204, 204, 0.5)";

        const buffered_width = this.htmlControls.progress.buffered.width;
        const buffered_height = this.htmlControls.progress.buffered.height;
        context.clearRect(0, 0, buffered_width, buffered_height);

        const duration = this.htmlVideo.duration;
        for (let i = 0; i < this.htmlVideo.buffered.length; i++) {
            let start = this.htmlVideo.buffered.start(i) / duration;
            let end = this.htmlVideo.buffered.end(i) / duration;

            let x = Math.floor(buffered_width * start);
            let width = Math.ceil(buffered_width * end - buffered_width * start);
            context.fillRect(x, 0, width, buffered_height);
        }
    };

    attachHtmlEvents() {
        this.htmlSeekBackward.addEventListener("dblclick", (e) => {
            if (!this.options.enableDoubleTapSeek) {
                return;
            }

            this.htmlSeekBackward.classList.add("animate");
            let timestamp = this.getNewTime(-this.options.seekBy);
            this.fireControlsSeeked(timestamp);
            this.seek(timestamp);
            consumeEvent(e);
        });

        this.htmlSeekForward.addEventListener("dblclick", (e) => {
            if (!this.options.enableDoubleTapSeek) {
                return;
            }

            this.htmlSeekForward.classList.add("animate");
            let timestamp = this.getNewTime(this.options.seekBy);
            this.fireControlsSeeked(timestamp);
            this.seek(timestamp);
            consumeEvent(e);
        });

        // Prevents selecting the video element along with the rest of the page
        this.htmlVideo.classList.add("unselectable");

        this.htmlPlayerRoot.addEventListener("mousemove", () => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mousedown", () => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseup", () => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseenter", () => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseleave", () => {
            this.hidePlayerUI();
        });

        this.htmlControls.playToggleButton.addEventListener("click", () => {
            this.togglePlay();
        });

        this.htmlControls.nextButton.addEventListener("click", () => {
            this.fireControlsNext();
        });

        this.htmlControls.loopButton.addEventListener("click", () => {
            this.loopEnabled = !this.loopEnabled;
            this.fireControlsLoop(this.loopEnabled);

            // NOTE(kihau): Temporary goofyness for testing
            if (this.loopEnabled) {
                this.htmlImgs.loop.style.filter = "invert(19%) sepia(80%) saturate(4866%) hue-rotate(354deg) brightness(106%) contrast(127%)";
            } else {
                this.htmlImgs.loop.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";
            }
        });

        this.htmlControls.autoplay.addEventListener("click", () => {
            this.autoplayEnabled = !this.autoplayEnabled;
            this.fireControlsAutoplay(this.autoplayEnabled);

            // NOTE(kihau): Temporary goofyness for testing
            if (this.autoplayEnabled) {
                this.htmlImgs.autoplay.style.filter = "invert(19%) sepia(80%) saturate(4866%) hue-rotate(354deg) brightness(106%) contrast(127%)";
            } else {
                this.htmlImgs.autoplay.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";
            }
        });

        this.htmlControls.volume.addEventListener("click", () => {
            if (this.htmlControls.volumeSlider.value == 0) {
                this.fireControlsVolumeSet(this.volumeBeforeMute);
                this.setVolume(this.volumeBeforeMute);
            } else {
                this.volumeBeforeMute = this.htmlControls.volumeSlider.value;
                this.fireControlsVolumeSet(0);
                this.setVolume(0);
            }
        });

        this.htmlControls.subs.addEventListener("click", () => {
            let menuRootElement = this.htmlControls.subMenu.root;
            let visible = menuRootElement.style.display !== "none";
            if (visible) {
                hideElement(menuRootElement);
            } else {
                menuRootElement.style.display = "";
            }
        });

        this.htmlPlayerRoot.addEventListener("keydown", (event) => {
            if (event.key == " " || event.code == "Space" || event.keyCode == 32) {
                this.togglePlay();
                consumeEvent(event);
            }

            if (event.key == "ArrowLeft" || event.keyCode == 37) {
                this.htmlSeekBackward.classList.add("animate");

                let timestamp = this.getNewTime(-this.options.seekBy);
                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
                consumeEvent(event);
            }

            if (event.key == "ArrowRight" || event.keyCode == 39) {
                this.htmlSeekForward.classList.add("animate");

                // We should use options here
                let timestamp = this.getNewTime(this.options.seekBy);
                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
                consumeEvent(event);
            }

            if (event.key == "ArrowUp" || event.keyCode == 38) {
                this.setVolumeRelative(0.1);
                consumeEvent(event);
            }

            if (event.key == "ArrowDown" || event.keyCode == 40) {
                this.setVolumeRelative(-0.1);
                consumeEvent(event);
            }
        });

        this.htmlPlayerRoot.addEventListener("click", (_event) => {
            this.togglePlay();
        });

        this.htmlVideo.addEventListener("waiting", () => {
            this.bufferingTimeoutId = setTimeout(() => {
            this.htmlBuffering.style.display = "";
            }, 200);
        });

        this.htmlVideo.addEventListener("playing", () => {
            clearTimeout(this.bufferingTimeoutId);
            hideElement(this.htmlBuffering);
        });

        this.htmlVideo.addEventListener("timeupdate", (_event) => {
            let timestamp = this.htmlVideo.currentTime;
            this.updateTimestamps(timestamp);
        });

        this.htmlVideo.addEventListener("ended", (_event) => {
            this.firePlaybackEnd();
        });

        this.htmlControls.fullscreen.addEventListener("click", () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
                this.htmlImgs.fullscreen.src = this.resources.fullscreenImg;
            } else {
                this.htmlPlayerRoot.requestFullscreen();
                this.htmlImgs.fullscreen.src = this.resources.fullscreenExitImg;
            }
        });

        document.addEventListener("fullscreenchange", () => {
            // This is after the fact when a user exited without using the icon
            if (document.fullscreenElement) {
                this.htmlImgs.fullscreen.src = this.resources.fullscreenExitImg;
            } else {
                this.htmlImgs.fullscreen.src = this.resources.fullscreenImg;
            }
        });

        this.htmlControls.volumeSlider.addEventListener("input", _event => {
            let volume = this.htmlControls.volumeSlider.value;
            this.fireControlsVolumeSet(volume);
            this.setVolume(volume);
        });

        let calculateProgress = (event, element) => {
            let rect = element.getBoundingClientRect();
            let offsetX;

            if (event.touches) {
                offsetX = event.touches[0].clientX - rect.left;
            } else {
                offsetX = event.clientX - rect.left;
            }

            // Ensure the touch doesn't exceed slider bounds
            if (offsetX < 0) offsetX = 0;
            if (offsetX > rect.width) offsetX = rect.width;

            let progress = offsetX / rect.width;
            if (isNaN(progress)) {
                progress = 0;
            }

            return progress;
        }

        this.htmlControls.progress.root.addEventListener("mousedown", _event => {
            const onProgressBarMouseMove = event => {
                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                this.updateProgressBar(progress);
            }

            const onProgressBarMouseUp = event => {
                this.isDraggingProgressBar = false;
                document.removeEventListener('mousemove', onProgressBarMouseMove);
                document.removeEventListener('mouseup', onProgressBarMouseUp);

                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                const timestamp = this.htmlVideo.duration * progress;

                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
            }

            this.isDraggingProgressBar = true;
            document.addEventListener('mousemove', onProgressBarMouseMove);
            document.addEventListener('mouseup', onProgressBarMouseUp);
        });

        this.htmlControls.progress.root.addEventListener("mouseenter", _event => {
            this.htmlControls.progress.thumb.style.display = "";
            this.htmlControls.progress.popupRoot.style.display = "";
            this.setProgressMargin(4);
            this.updateTimestamps(this.htmlVideo.currentTime);
        });

        this.htmlControls.progress.root.addEventListener("mousemove", event => {
            const value = calculateProgress(event, this.htmlControls.progress.root);
            const timestamp = this.htmlVideo.duration * value;

            this.htmlControls.progress.popupRoot.style.left = value * 100 + "%";
            this.htmlControls.progress.popupRoot.style.display = "";
            this.htmlControls.progress.popupText.textContent = createTimestampString(timestamp);
        });

        this.htmlControls.progress.root.addEventListener("mouseleave", _event => {
            hideElement(this.htmlControls.progress.thumb);
            hideElement(this.htmlControls.progress.popupRoot);
            this.setProgressMargin(5);
        });

        this.htmlSeekBackward.addEventListener("transitionend", () => {
            this.htmlSeekBackward.classList.remove("animate");
        });

        this.htmlSeekForward.addEventListener("transitionend", () => {
            this.htmlSeekForward.classList.remove("animate");
        });

        this.htmlPlayTogglePopup.addEventListener("transitionend", () => {
            this.htmlPlayTogglePopup.classList.remove("animate");
        });
    }

    initializeImageSources() {
        let res = this.resources;

        this.preloadResources()

        let imgs = this.htmlImgs;
        imgs.seekForward = this.createImgElementWithSrc(res.seekForwardImg, 70, 70);
        imgs.seekBackward = this.createImgElementWithSrc(res.seekBackwardImg, 70, 70);
        imgs.playToggle = this.createImgElementWithSrc(res.playImg, 20, 20)
        imgs.next = this.createImgElementWithSrc(res.nextImg, 20, 20);
        imgs.loop = this.createImgElementWithSrc(res.loopImg, 20, 20)

        // NOTE(kihau): Temporary goofyness for testing
        imgs.loop.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";

        imgs.volume = this.createImgElementWithSrc(res.volumeFullImg, 20, 20);
        imgs.download = this.createImgElementWithSrc(res.downloadImg, 20, 20);
        imgs.autoplay = this.createImgElementWithSrc(res.autoplayImg, 20, 20);

        // NOTE(kihau): Temporary goofyness for testing
        imgs.autoplay.style.filter = "invert(100%) sepia(63%) saturate(0%) hue-rotate(137deg) brightness(112%) contrast(101%)";

        imgs.subs = this.createImgElementWithSrc(res.subsImg, 20, 20)
        imgs.settings = this.createImgElementWithSrc(res.settingsImg, 20, 20)
        imgs.fullscreen = this.createImgElementWithSrc(res.fullscreenImg, 20, 20)
    }

    preloadResources() {
        // Not preloading swappable graphic is very likely to trigger multiple NS_BINDING_ABORTED exceptions
        // and also lag the browser, therefore we must preload or merge all icons into a single .svg file
        let res = this.resources;
        new Image().src = res.playImg;
        new Image().src = res.pauseImg;
        new Image().src = res.volumeFullImg;
        new Image().src = res.volumeMediumImg;
        new Image().src = res.volumeLowImg;
        new Image().src = res.volumeMutedImg;
    }

    createImgElementWithSrc(src, width, height) {
        let img = document.createElement("img");
        img.src = src;
        img.width = width;
        img.height = height;
        img.setAttribute("class", "unselectable");
        return img;
    }

    assembleProgressBar() {
        let progress =  this.htmlControls.progress;
        this.htmlControls.root.appendChild(progress.root);

        progress.root.appendChild(progress.total);
        progress.root.appendChild(progress.buffered);
        progress.root.appendChild(progress.current);
        progress.root.appendChild(progress.thumb);
        progress.root.appendChild(progress.popupRoot);

        progress.popupText.textContent = "00:00";
        progress.popupRoot.appendChild(progress.popupText);

        hideElement(progress.popupRoot);
    }

    createHtmlControls() {
        let playerControls = this.htmlControls.root;
        playerControls.addEventListener("click", consumeEvent);
        playerControls.addEventListener("focusout", () => {
            // otherwise document.body will receive focus
            this.htmlPlayerRoot.focus();
        });

        this.assembleProgressBar();

        let playToggle = this.htmlControls.playToggleButton;
        playToggle.classList.add("responsive");
        playToggle.title = "Play/Pause";
        playToggle.appendChild(this.htmlImgs.playToggle);
        playToggle.style.display = this.options.hidePlayToggleButton ? "none" : "";
        playerControls.appendChild(playToggle);

        let next = this.htmlControls.nextButton;
        next.classList.add("responsive");
        next.title = "Next";
        next.appendChild(this.htmlImgs.next);
        next.style.display = this.options.hideNextButton ? "none" : "";
        playerControls.appendChild(next);

        let loop = this.htmlControls.loopButton;
        loop.classList.add("responsive");
        loop.title = "Loop";
        loop.appendChild(this.htmlImgs.loop);
        loop.style.display = this.options.hideLoopingButton ? "none" : "";
        playerControls.appendChild(loop);

        let volume = this.htmlControls.volume;
        volume.classList.add("responsive");
        volume.title = "Mute/Unmute";
        volume.appendChild(this.htmlImgs.volume);
        volume.style.display = this.options.hideVolumeButton ? "none" : "";
        playerControls.appendChild(volume);

        let volumeSlider = this.htmlControls.volumeSlider;
        volumeSlider.type = "range";
        volumeSlider.min = "0";
        volumeSlider.max = "1";
        volumeSlider.value = "1";
        volumeSlider.step = "any";
        volumeSlider.style.display = this.options.hideVolumeSlider ? "none" : "";
        playerControls.appendChild(volumeSlider);

        let timestamp = this.htmlControls.timestamp;
        timestamp.textContent = "00:00 / 00:00";
        timestamp.style.display = this.options.hideTimestamps ? "none" : "";
        playerControls.appendChild(timestamp);

        let firstAutoMargin = true;

        let download = this.htmlControls.download;
        download.classList.add("responsive");
        download.title = "Download";
        download.appendChild(this.htmlImgs.download);
        if (this.options.hideDownloadButton) {
            hideElement(download);
        } else {
            download.style.marginLeft = firstAutoMargin ? "auto" : "0";
            firstAutoMargin = false;
        }
        playerControls.appendChild(download);

        let autoplay = this.htmlControls.autoplay;
        autoplay.classList.add("responsive");
        autoplay.title = "Autoplay";
        autoplay.appendChild(this.htmlImgs.autoplay);
        if (this.options.hideAutoplayButton) {
            hideElement(autoplay);
        } else {
            autoplay.style.marginLeft = firstAutoMargin ? "auto" : "0";
            firstAutoMargin = false;
        }

        playerControls.appendChild(autoplay);

        let subs = this.htmlControls.subs;
        subs.classList.add("responsive");
        subs.title = "Subtitles";
        subs.appendChild(this.htmlImgs.subs);
        if (this.options.hideSubtitlesButton) {
            hideElement(subs);
        } else {
            subs.style.marginLeft = firstAutoMargin ? "auto" : "0";
            firstAutoMargin = false;
        }
        playerControls.appendChild(subs);

        let settings = this.htmlControls.settings;
        settings.classList.add("responsive");
        settings.title = "Settings";
        settings.appendChild(this.htmlImgs.settings);
        if (this.options.hideSettingsButton) {
            hideElement(settings);
        } else {
            settings.style.marginLeft = firstAutoMargin ? "auto" : "0";
            firstAutoMargin = false;
        }
        playerControls.appendChild(settings);

        let fullscreen = this.htmlControls.fullscreen;
        fullscreen.classList.add("responsive");
        fullscreen.title = "Fullscreen";
        fullscreen.appendChild(this.htmlImgs.fullscreen);
        if (this.options.hideFullscreenButton) {
            hideElement(fullscreen);
        } else {
            fullscreen.style.marginLeft = firstAutoMargin ? "auto" : "0";
        }
        playerControls.appendChild(fullscreen);
        this.htmlPlayerRoot.appendChild(playerControls);
    }

    createSubtitleTrackElement(title) {
        let menu = this.htmlControls.subMenu;

        let track = newDiv();
        track.className = "subtitle_track";
        track.onclick = _event => {
            if (menu.selected.track) {
                menu.selected.track.classList.remove("player_submenu_selected");
            }

            track.classList.add("player_submenu_selected");
            menu.selected.track = track;

            // TODO(kihau): We can now do something here on subtitle track selection.
        }

        let trackTitle = newDiv();
        trackTitle.textContent = title;
        trackTitle.className = "subtitle_track_text";

        let trackButtons = newDiv();
        trackButtons.className = "subtitle_track_buttons";

        let trackEdit = document.createElement("button");
        trackEdit.className = "subtitle_track_edit_button";
        trackEdit.textContent = "⚙️";
        let trackRemove = document.createElement("button");
        trackRemove.className = "subtitle_track_remove_button";
        trackRemove.textContent = "🗑";

        trackButtons.appendChild(trackEdit);
        trackButtons.appendChild(trackRemove);

        track.appendChild(trackTitle);
        track.appendChild(trackButtons);

        return track;
    }

   createSubtitleMenu() {
        let menu = this.htmlControls.subMenu;

        let root = menu.root;
        root.onclick = consumeEvent;
        // hideElement(root);
        this.htmlPlayerRoot.appendChild(root);

        { // player_submenu_top
            let top = newDiv("player_submenu_top");
            root.appendChild(top);

            let select = menu.top.selectButton;
            select.innerHTML = "Select"
            select.classList.add("player_submenu_top_button")
            select.classList.add("unselectable")
            select.style.display = ""

            top.appendChild(select);

            let search = menu.top.searchButton
            search.innerHTML = "Search"
            search.classList.add("player_submenu_top_button")
            search.classList.add("unselectable")
            search.style.display = ""
            top.appendChild(search);

            let options = menu.top.optionsButton;
            options.innerHTML = "Options"
            options.classList.add("player_submenu_top_button")
            options.classList.add("unselectable")
            options.style.display = ""
            top.appendChild(options);

            let attachSelectionClick = (button, bottom) => {
                button.onclick = () => {
                    let selected = this.htmlControls.subMenu.selected;
                    selected.button.classList.remove("player_submenu_selected");
                    selected.bottom.style.display = "none";

                    selected.button = button
                    selected.bottom = bottom;

                    selected.button.classList.add("player_submenu_selected");
                    selected.bottom.style.display = "";
                };
            }

            attachSelectionClick(menu.top.selectButton, menu.bottom.selectRoot);
            attachSelectionClick(menu.top.searchButton, menu.bottom.searchRoot);
            attachSelectionClick(menu.top.optionsButton, menu.bottom.optionsRoot);
        }

        // Separator between top and bottom menu.
        let separator = newElement("hr", null, "player_submenu_separator");
        root.appendChild(separator);

        { // player_submenu_bottom
            let bottom = newDiv("player_submenu_bottom");
            root.appendChild(bottom);

            let select = menu.bottom.selectRoot;
            select.style.display = "none";

            { // The horrible toggle that needs to be changed
                let toggle = newElement("toggle", null, "toggle");
                select.appendChild(toggle);

                let checkbox = document.createElement("input");
                checkbox.className = "toggle-checkbox";
                checkbox.type = "checkbox";
                toggle.appendChild(checkbox);
                checkbox.addEventListener("change", (event) => {
                    console.log(event.target.checked);
                });

                let toggleSwitch = newDiv();
                toggleSwitch.className = "toggle-switch";
                toggle.appendChild(toggleSwitch);

                let text = document.createElement("span");
                text.textContent = "    Enable subtitles";
                text.className = "text_color";
                toggle.appendChild(text);
            }

            let separator = newElement("hr", null, "player_submenu_separator");
            select.appendChild(separator);
            select.appendChild(menu.trackList);
            bottom.appendChild(select);

            // // NOTE(kihau): Dummy code for testing:
            menu.trackList.appendChild(this.createSubtitleTrackElement("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("This is a long subtitle name.vtt"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("Foo Bar"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("AAAAAA"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("BBBBBB"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("CCCCCC"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("DDDDDD"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("EEEEEE"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("FFFFFF"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("GGGGGG"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("HHHHHH"));
            menu.trackList.appendChild(this.createSubtitleTrackElement("IIIIII"));
            // // -----------------------------------

            let search = menu.bottom.searchRoot;
            // search.textContent = "SEARCH";
            search.style.display = "none";
            bottom.appendChild(search);

            let options = menu.bottom.optionsRoot;
            // options.textContent = "OPTIONS";
            options.style.display = "none";

            { // player_submenu_shift_root
                let root = newDiv("player_submenu_shift_root");

                // Top container:
                let top = newDiv("player_submenu_shift_top");
                let textSpan = newElement("span", "player_submenu_shift_text");
                textSpan.textContent = "Subtitle delay";

                let valueSpan = newElement("span", "player_submenu_shift_value");
                valueSpan.textContent = "+0.0s";

                // Bottom container:
                let bottom = newDiv("player_submenu_shift_bottom");

                let leftButton = newElement("button", null, "player_submenu_shift_button");
                // leftButton.appendChild(newSvg("svg/arrow.svg#left", null, "shift_arrow"));

                {
                    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svg.setAttribute("viewBox", "0 0 24 24");
                    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M14.2893 5.70708C13.8988 5.31655 13.2657 5.31655 12.8751 5.70708L7.98768 10.5993C7.20729 11.3805 7.2076 12.6463 7.98837 13.427L12.8787 18.3174C13.2693 18.7079 13.9024 18.7079 14.293 18.3174C14.6835 17.9269 14.6835 17.2937 14.293 16.9032L10.1073 12.7175C9.71678 12.327 9.71678 11.6939 10.1073 11.3033L14.2893 7.12129C14.6799 6.73077 14.6799 6.0976 14.2893 5.70708Z");
                    svg.append(path);
                    leftButton.appendChild(svg);
                }

                let slider = newElement("input", "player_submenu_shift_slider");
                slider.type = "range";
                slider.min = -10.0;
                slider.max = 10.0;
                slider.step = 0.1;
                slider.value = 0.0;

                let rightButton = newElement("button", null, "player_submenu_shift_button");
                // rightButton.appendChild(newSvg("svg/arrow.svg#right", null, "shift_arrow"));

                {
                    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svg.setAttribute("viewBox", "0 0 24 24");
                    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", "M9.71069 18.2929C10.1012 18.6834 10.7344 18.6834 11.1249 18.2929L16.0123 13.4006C16.7927 12.6195 16.7924 11.3537 16.0117 10.5729L11.1213 5.68254C10.7308 5.29202 10.0976 5.29202 9.70708 5.68254C9.31655 6.07307 9.31655 6.70623 9.70708 7.09676L13.8927 11.2824C14.2833 11.6729 14.2833 12.3061 13.8927 12.6966L9.71069 16.8787C9.32016 17.2692 9.32016 17.9023 9.71069 18.2929Z");
                    svg.append(path);
                    rightButton.appendChild(svg);
                }

                let setValueSpan = (value) => {
                    let max = Number(slider.max);
                    if (value > max) {
                        value = max;
                    }

                    let min = Number(slider.min);
                    if (value < min) {
                        value = min;
                    }

                    // Set precision to a single digit of the fractional part;
                    value = Math.round(value * 10.0) / 10.0;

                    let valueString = "";
                    if (value >= 0) {
                        valueString = "+";
                    }

                    valueString += value;

                    // Append ".0" when the value has no fractional part.
                    if ((value * 10) % 10 === 0.0) {
                        valueString += ".0";
                    }

                    valueString += "s";
                    valueSpan.textContent = valueString;
                }

                rightButton.onclick = () => {
                    let newValue = Number(slider.value) + 0.3;
                    setValueSpan(newValue);
                    slider.value = newValue;
                }

                slider.oninput = () => {
                    let value = Number(slider.value);
                    setValueSpan(value);
                }

                leftButton.onclick = () => {
                    let newValue = Number(slider.value) - 0.3;
                    setValueSpan(newValue);
                    slider.value = newValue;
                }


                top.appendChild(textSpan);
                top.appendChild(valueSpan);

                bottom.appendChild(leftButton);
                bottom.appendChild(slider);
                bottom.appendChild(rightButton);

                root.appendChild(top);
                root.appendChild(bottom);

                // let separator = newElement("hr", null, "player_submenu_separator");
                // root.appendChild(separator);

                options.appendChild(root);
            }

            bottom.appendChild(options);
        }

        menu.selected.button = menu.top.selectButton;
        menu.selected.bottom = menu.bottom.selectRoot;

        menu.selected.button.classList.add("player_submenu_selected");
        menu.selected.bottom.style.display = "";


        // Subtitle menu bottom div
        // menu.bottomRoot = newDiv("player_bot_root");
        // let bottomRoot = menu.bottomRoot;
        // menuRoot.appendChild(bottomRoot);
        //
        // menu.optionButtons = newDiv("option_buttons");
        // let optionButtons = menu.optionButtons;
        // optionButtons.classList.add("menu_item");
        // optionButtons.classList.add("unselectable");
        // optionButtons.style.display = "";
        // bottomRoot.appendChild(optionButtons);
        //
        // menu.subtitleList = newDiv("subtitle_list");
        // let subtitleList = menu.subtitleList;
        // subtitleList.classList.add("unselectable");
        // hideElement(subtitleList);
        // bottomRoot.appendChild(subtitleList);
        //
        // // Move these click actions below to attachHtmlEvents?
        //
        // // Append options
        // let toggleButton = newDiv();
        // menu.toggleButton = toggleButton
        // toggleButton.textContent = "Enable subs"
        // toggleButton.classList.add("menu_item")
        // toggleButton.classList.add("unselectable")
        // toggleButton.addEventListener("click", () => {
        //     this.toggleCurrentTrackVisibility()
        //     if (menu.enabledSubs) {
        //         menu.enabledSubs = false;
        //         toggleButton.textContent = "Enable subs";
        //     } else {
        //         menu.enabledSubs = true;
        //         toggleButton.textContent = "Disable subs";
        //     }
        // });
        //
        // optionButtons.appendChild(toggleButton);
        //
        // let chooseButton = newDiv();
        // menu.chooseButton = chooseButton
        // chooseButton.textContent = "Choosing"
        // chooseButton.classList.add("menu_item")
        // chooseButton.classList.add("unselectable")
        // chooseButton.addEventListener("click", () => {
        //     menu.depth++;
        //     menu.selectedLabel.textContent = "Choose track";
        //     hideElement(menu.optionButtons);
        //     menu.subtitleList.style.display = "";
        //     menu.subtitleList.innerHTML = "";
        //     let textTracks = this.htmlVideo.textTracks;
        //     for (let i = 0; i < textTracks.length; i++) {
        //         let track = textTracks[i];
        //         const trackDiv = newDiv();
        //         trackDiv.textContent = track.label;
        //         trackDiv.classList.add("subtitle_item");
        //         trackDiv.classList.add("unselectable");
        //         trackDiv.onclick = () => {
        //             console.log("User selected", track.label)
        //             this.enableSubtitleTrack(i)
        //         }
        //         console.log("Appending", track.label)
        //         menu.subtitleList.appendChild(trackDiv);
        //     }
        // })
        // optionButtons.appendChild(chooseButton);
        //
        // let customizeButton = newDiv();
        // menu.customizeButton = customizeButton
        // customizeButton.innerHTML = "Customize sub"
        // customizeButton.classList.add("menu_item")
        // customizeButton.classList.add("unselectable")
        // customizeButton.addEventListener("click", () => {
        //     menu.depth++;
        //     menu.selectedLabel.innerHTML = "Customizing"
        //     hideElement(menu.optionButtons);
        // })
        // optionButtons.appendChild(customizeButton);
        //
        // let downloadButton = newDiv();
        // menu.downloadButton = downloadButton
        // downloadButton.innerHTML = "Download sub"
        // downloadButton.classList.add("menu_item")
        // downloadButton.classList.add("unselectable")
        // downloadButton.addEventListener("click", () => {
        //     menu.depth++;
        //     menu.selectedLabel.innerHTML = "Download"
        //     hideElement(menu.optionButtons);
        // })
        // optionButtons.appendChild(downloadButton);
        //
        // this.htmlPlayerRoot.appendChild(menuRoot);
    }
}

function createTimestampString(timestamp) {
    let seconds = Math.floor(timestamp % 60.0);
    let minutes = Math.floor(timestamp / 60.0);

    let timestamp_string = "";
    if (minutes < 10) {
        timestamp_string += "0";
    }

    timestamp_string += minutes;
    timestamp_string += ":";

    if (seconds < 10) {
        timestamp_string += "0";
    }

    timestamp_string += seconds;
    return timestamp_string;
}

function newDiv(id) {
    let div = document.createElement("div")
    // tabIndex makes divs focusable so that they can receive and bubble key events
    div.tabIndex = -1
    if (id) {
        div.id = id
    }
    return div;
}


function newSvg(path, id, className) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    if (id) svg.id = id;
    if (className) svg.classList.add(className);

    let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.appendChild(use);
    use.setAttribute("href", path);
    return svg;
}


function newElement(type, id, className) {
    let element = document.createElement(type);

    // element.tabIndex = -1;

    if (id) {
        element.id = id;
    }

    if (className) {
        element.className = className;
    }

    return element;
}

function newImg(id) {
    let img = document.createElement("img")
    if (id) {
        img.id = id
    }
    return img;
}

function consumeEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

function isFunction(func) {
    return func != null && typeof func === "function";
}

// For example: Linux cannot be included as a desktop agent because it also appears along Android
// Similarly: Macintosh cannot be included as a desktop agent because it also appears along iPad
// What about TVs?
const MOBILE_AGENTS = ["Mobile", "Tablet", "Android", "iPhone", "iPod", "iPad"];
function isMobileAgent() {
    let userAgent = navigator.userAgent.trim();
    if (!userAgent || userAgent === "") {
        return false;
    }
    let bracketOpen = userAgent.indexOf("(");
    if (bracketOpen === -1) {
        return false;
    }
    let bracketClose = userAgent.indexOf(")", bracketOpen + 1);
    if (bracketClose === -1) {
        return false;
    }

    let systemInfo = userAgent.substring(bracketOpen + 1, bracketClose).trim();
    console.log(systemInfo);
    for (let i = 0; i < systemInfo.length; i++) {
        if (systemInfo.includes(MOBILE_AGENTS[i])) {
            return true;
        }
    }
    return false;
}

// This is a separate class for more clarity
class Options {
    constructor() {
        this.hidePlayToggleButton = false;
        this.hideNextButton = false;
        this.hideLoopingButton = false;
        this.hideVolumeButton = false;
        this.hideVolumeSlider = false;
        this.hideTimestamps = false;
        this.hideDownloadButton = false;
        this.hideAutoplayButton = false;
        this.hideSubtitlesButton = false;
        this.hideSettingsButton = false;
        this.hideFullscreenButton = false;

        this.doubleTapThresholdMs = 300;
        this.enableDoubleTapSeek = isMobileAgent();

        // [Arrow keys/Double tap] seeking offset provided in seconds.
        this.seekBy = 5;

        // Delay in milliseconds before controls disappear.
        this.inactivityTime = 2500;

        // Disable the auto hide for player controls.
        this.disableControlsAutoHide = false;

        this.bufferingRedrawInterval = 1000;
    }

    // Ensure values are the intended type and within some reasonable range
    valid() {
        if (typeof this.seekBy !== "number" || this.seekBy < 0) {
            return false;
        }
        if (typeof this.inactivityTime !== "number" || this.inactivityTime < 0) {
            return false;
        }
        if (
            !this.areAllBooleans(
                this.hidePlayToggleButton,
                this.hideNextButton,
                this.hideLoopingButton,
                this.hideVolumeButton,
                this.hideVolumeSlider,
                this.hideTimestamps,
                this.hideDownloadButton,
                this.hideSubtitlesButton,
                this.hideSettingsButton,
                this.hideFullscreenButton,
            )
        ) {
            console.debug("Visibility flags are not all booleans!");
            return false;
        }
        return true;
    }
    areAllBooleans(...variables) {
        for (let i = 0; i < variables.length; i++) {
            if (typeof variables[i] != "boolean") {
                return false;
            }
        }
        return true;
    }
}

export class Perf {
    constructor() {
        this.start = performance.now();
    }

    static start() {
        return new Perf()
    }

    getElapsed() {
        return performance.now() - this.start
    }

    printElapsed() {
        let end = performance.now();
        console.log(end - this.start)
    }
}
