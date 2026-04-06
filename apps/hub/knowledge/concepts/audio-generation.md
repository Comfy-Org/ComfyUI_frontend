# Audio Generation

Audio generation in ComfyUI covers creating speech (text-to-speech), music, and sound effects from text prompts or reference audio. Dedicated audio models run within ComfyUI's node graph, letting you integrate audio creation into larger multimedia workflows — for example, generating a video and its soundtrack in a single pipeline.

## How It Works in ComfyUI

- Key nodes involved: Model-specific nodes (`CosyVoice` nodes for TTS, `StableAudio` nodes for music/SFX), audio preview and save nodes, `AudioScheduler`
- Typical workflow pattern: Load audio model → Provide text/reference input → Generate audio → Preview/save audio

## Key Settings

- **Sample rate**: Output audio quality, typically 24000–48000 Hz. Higher rates capture more detail but produce larger files.
- **Duration**: Length of generated audio in seconds. Longer durations may reduce quality or coherence depending on the model.
- **Voice reference**: For voice cloning, a short audio clip of the target voice (3–10 seconds of clean speech works best).
- **Text input**: The text to be spoken (TTS) or the description of the desired audio (music/SFX generation).

## Tips

- CosyVoice and F5-TTS are popular choices for text-to-speech in ComfyUI, each with dedicated custom nodes.
- Stable Audio Open handles music and sound effect generation from text descriptions.
- Use clean, noise-free reference audio clips for voice cloning to get the best results.
- Keep text inputs short and well-punctuated for the highest quality speech output — long paragraphs may degrade in naturalness.
