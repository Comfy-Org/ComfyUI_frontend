# Chatterbox

Chatterbox is a family of state-of-the-art open-source text-to-speech models developed by Resemble AI, featuring zero-shot voice cloning and emotion control.

## Model Variants

### Chatterbox Turbo

- 350M parameters, single-step mel decoding for low latency
- Paralinguistic tags for non-speech sounds ([laugh], [cough], [chuckle])
- English only, optimized for voice agents and production use

### Chatterbox (Original)

- 500M parameter Llama backbone, English only
- CFG and exaggeration control for emotion intensity

### Chatterbox Multilingual

- 500M parameters, 23 languages (Arabic, Chinese, French, German, Hindi, Japanese, Korean, Spanish, and more)
- Zero-shot voice cloning across languages

## Key Features

- Zero-shot voice cloning from a few seconds of reference audio
- Emotion exaggeration control (first open-source model with this feature)
- Built-in PerTh neural watermarking for responsible AI
- Sub-200ms latency for real-time applications
- Trained on 500K hours of cleaned speech data
- MIT license (free for commercial use)
- Outperforms ElevenLabs in subjective evaluations

## Hardware Requirements

- Minimum: NVIDIA GPU with CUDA support
- Turbo model requires less VRAM than original due to smaller architecture
- Runs on consumer GPUs (RTX 3060 and above)
- CPU inference possible but significantly slower

## Common Use Cases

- Voice cloning for content creation
- AI voice agents and assistants
- Audiobook narration
- Game and media dialogue generation

## Key Parameters

- **exaggeration**: Emotion intensity control (0.0 to 1.0, default 0.5)
- **cfg_weight**: Classifier-free guidance weight (0.0 to 1.0, default 0.5)
- **audio_prompt_path**: Path to reference audio clip for voice cloning
- **language_id**: Language code for multilingual model (e.g., "fr", "zh", "ja")
