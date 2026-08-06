import { comfy } from '/comfy/api/v1.js';
const { api } = window.comfyAPI.api;

comfy.defs.extend("PlaySoundKJ", (b) => {
    // Per-node playback state: handles carry no arbitrary properties, so the
    // former this._kj* fields live here, keyed by node.id.
    const states = new Map();
    const stateFor = (node) => {
        if (!states.has(node.id)) states.set(node.id, {});
        return states.get(node.id);
    };
    // Was inline in onExecuted; shared now that removal has to clean up too.
    const stopPlayback = (state) => {
        if (state.statusListener) {
            api.removeEventListener("status", state.statusListener);
            state.statusListener = null;
        }
        clearTimeout(state.queueDebounce);
        state.pendingAudio = null;

        if (state.playingAudio) {
            state.playingAudio.pause();
            state.playingAudio = null;
        }
        if (state.playTimer != null) {
            clearTimeout(state.playTimer);
            state.playTimer = null;
        }
    };

    // "status" is the queue-status event, not a node preview, so it stays on
    // the api client.
    b.onExecuted((node, result) => {
        const audios = result.raw?.audio;
        if (!audios?.length) return;

        const state = stateFor(node);
        const modeWidget = node.widgets.get("mode");
        const volumeWidget = node.widgets.get("volume");
        const durationWidget = node.widgets.get("duration");
        const mode = modeWidget?.getValue() ?? "always";
        const volume = volumeWidget?.getValue() ?? 0.5;
        const duration = durationWidget?.getValue() ?? 0;

        // on_change: skip if audio content hasn't changed
        if (mode === "on_change") {
            const audioHash = result.raw?.audio_hash?.[0];
            if (audioHash != null && state.lastAudioHash === audioHash) return;
            state.lastAudioHash = audioHash;
        }

        // Clean up previous state
        stopPlayback(state);

        const startPlayback = () => {
            const { filename, subfolder, type } = audios[0];
            const params = new URLSearchParams({
                filename: filename ?? "",
                subfolder: subfolder ?? "",
                type: type ?? "temp",
            });
            const url = api.apiURL(`/view?${params.toString()}`);
            const audio = new Audio(url);
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.play().catch(() => {});
            state.playingAudio = audio;
            if (duration > 0) {
                state.playTimer = setTimeout(() => {
                    audio.pause();
                    state.playingAudio = null;
                    state.playTimer = null;
                }, duration * 1000);
            }
        };

        if (mode === "on_empty_queue") {
            state.pendingAudio = startPlayback;
            state.statusListener = ({ detail }) => {
                const remaining = detail?.exec_info?.queue_remaining ?? 0;
                if (remaining === 0) {
                    // Debounce: confirm queue is truly empty
                    // (status can briefly show 0 between dispatches)
                    clearTimeout(state.queueDebounce);
                    state.queueDebounce = setTimeout(() => {
                        if (state.pendingAudio) {
                            state.pendingAudio();
                            state.pendingAudio = null;
                        }
                        api.removeEventListener("status", state.statusListener);
                        state.statusListener = null;
                    }, 1000);
                } else {
                    clearTimeout(state.queueDebounce);
                }
            };
            api.addEventListener("status", state.statusListener);
        } else {
            startPlayback();
        }
    });

    // The old code hung its state off the node, so deleting one mid-playback
    // left the audio running and the "status" listener subscribed forever.
    b.onRemoved((node) => {
        const state = states.get(node.id);
        if (state) stopPlayback(state);
        states.delete(node.id);
    });
});
