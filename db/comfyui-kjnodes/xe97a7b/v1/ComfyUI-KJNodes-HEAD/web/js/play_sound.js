import { comfy } from '/comfy/api/v1.js';
const { api } = window.comfyAPI.api;

// Per-node playback state. Handles carry no arbitrary properties, so what used
// to be stashed on the node lives here, keyed by node id, and is released in
// onRemoved — which the original never did.
const playback = new Map();

comfy.defs.extend("PlaySoundKJ", (b) => {
    b.onExecuted((node, result) => {
        const audios = result.raw.audio;
        if (!audios?.length) return;

        let state = playback.get(node.id);
        if (!state) {
            state = {};
            playback.set(node.id, state);
        }

        const mode = node.widgets.get("mode")?.getValue() ?? "always";
        const volume = node.widgets.get("volume")?.getValue() ?? 0.5;
        const duration = node.widgets.get("duration")?.getValue() ?? 0;

        // on_change: skip if audio content hasn't changed
        if (mode === "on_change") {
            const audioHash = result.raw.audio_hash?.[0];
            if (audioHash != null && state._kjLastAudioHash === audioHash) return;
            state._kjLastAudioHash = audioHash;
        }

        // Clean up previous state
        if (state._kjStatusListener) {
            api.removeEventListener("status", state._kjStatusListener);
            state._kjStatusListener = null;
        }
        clearTimeout(state._kjQueueDebounce);
        state._kjPendingAudio = null;

        if (state._kjPlayingAudio) {
            state._kjPlayingAudio.pause();
            state._kjPlayingAudio = null;
        }
        if (state._kjPlayTimer != null) {
            clearTimeout(state._kjPlayTimer);
            state._kjPlayTimer = null;
        }

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
            state._kjPlayingAudio = audio;
            if (duration > 0) {
                state._kjPlayTimer = setTimeout(() => {
                    audio.pause();
                    state._kjPlayingAudio = null;
                    state._kjPlayTimer = null;
                }, duration * 1000);
            }
        };

        if (mode === "on_empty_queue") {
            state._kjPendingAudio = startPlayback;
            state._kjStatusListener = ({ detail }) => {
                const remaining = detail?.exec_info?.queue_remaining ?? 0;
                if (remaining === 0) {
                    // Debounce: confirm queue is truly empty
                    // (status can briefly show 0 between dispatches)
                    clearTimeout(state._kjQueueDebounce);
                    state._kjQueueDebounce = setTimeout(() => {
                        if (state._kjPendingAudio) {
                            state._kjPendingAudio();
                            state._kjPendingAudio = null;
                        }
                        api.removeEventListener("status", state._kjStatusListener);
                        state._kjStatusListener = null;
                    }, 1000);
                } else {
                    clearTimeout(state._kjQueueDebounce);
                }
            };
            api.addEventListener("status", state._kjStatusListener);
        } else {
            startPlayback();
        }
    });

    b.onRemoved((node) => {
        const state = playback.get(node.id);
        if (!state) return;
        if (state._kjStatusListener) {
            api.removeEventListener("status", state._kjStatusListener);
        }
        clearTimeout(state._kjQueueDebounce);
        clearTimeout(state._kjPlayTimer);
        if (state._kjPlayingAudio) state._kjPlayingAudio.pause();
        playback.delete(node.id);
    });
});
