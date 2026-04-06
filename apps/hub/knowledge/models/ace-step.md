# ACE-Step

ACE-Step is a foundation model for music generation developed by ACE Studio and StepFun. It uses diffusion-based generation with a Deep Compression AutoEncoder (DCAE) and a lightweight linear transformer to achieve state-of-the-art speed and musical coherence.

## Model Variants

### ACE-Step (3.5B)

- 3.5B parameter diffusion model
- DCAE encoder with linear transformer conditioning
- 27 or 60 inference steps recommended
- Apache 2.0 license

## Key Features

- 15x faster than LLM-based baselines (20 seconds for a 4-minute song on A100)
- Full-song generation with lyrics and structure
- Duration control for variable-length output
- Music remixing and style transfer
- Lyrics editing and vocal synthesis
- Supports 16+ languages including English, Chinese, Japanese, Korean, French, German, Spanish, and more
- Text-to-music from natural language descriptions

## Hardware Requirements

- RTX 3090: 12.76x real-time factor at 27 steps
- RTX 4090: 34.48x real-time factor at 27 steps
- NVIDIA A100: 27.27x real-time factor at 27 steps
- Apple M2 Max: 2.27x real-time factor at 27 steps
- Higher step counts (60) reduce speed by roughly half

## Common Use Cases

- Original music generation from text descriptions
- Song remixing and style transfer
- Lyrics-based music creation
- Multi-language vocal music generation
- Rapid music prototyping for content creators
- Background music and soundtrack generation

## Key Parameters

- **steps**: Inference steps (27 for speed, 60 for quality)
- **duration**: Target audio length in seconds (up to ~5 minutes)
- **lyrics**: Song lyrics text input for vocal generation
- **prompt**: Natural language description of desired music style and mood
- **seed**: Random seed for reproducible generation (results are seed-sensitive)
