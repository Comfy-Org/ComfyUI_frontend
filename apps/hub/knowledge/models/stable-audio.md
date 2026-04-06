# Stable Audio Open

Stable Audio Open 1.0 is Stability AI's open-source text-to-audio model for generating sound effects, production elements, and short musical clips.

## Model Variants

### Stable Audio Open 1.0

- 1.2B parameter latent diffusion model
- Transformer-based diffusion (DiT) architecture
- T5-base text encoder for conditioning
- Variational autoencoder for audio compression
- Stability AI Community License (non-commercial)

### Stable Audio (Commercial)

- Full-length music generation up to 3 minutes with audio-to-audio and inpainting
- Available via Stability AI platform API, commercial license

## Key Features

- Generates up to 47 seconds of stereo audio at 44.1kHz
- Text-prompted sound effects, drum beats, ambient sounds, and foley
- Variable-length output with timing control
- Fine-tunable on custom audio datasets
- Trained exclusively on Creative Commons licensed audio (CC0, CC BY, CC Sampling+)
- Strong performance for sound effects and field recordings
- Compatible with both stable-audio-tools and diffusers libraries

## Hardware Requirements

- Minimum: 8GB VRAM (fp16)
- Recommended: 12GB+ VRAM for comfortable inference
- Half-precision (fp16) supported for reduced memory
- Chunked decoding available for memory-constrained setups
- Inference speed: 8-20 diffusion steps per second depending on GPU

## Common Use Cases

- Sound effect and foley generation
- Drum beats and instrument riff creation
- Ambient soundscapes and background audio
- Music production elements and samples
- Audio prototyping for film and game sound design

## Key Parameters

- **steps**: Number of inference steps (100-200 recommended)
- **cfg_scale**: Classifier-free guidance scale (typically 7)
- **seconds_total**: Target audio duration (up to 47 seconds)
- **seconds_start**: Start time offset for timing control
- **negative_prompt**: Text describing undesired audio qualities
- **sampler_type**: Diffusion sampler (dpmpp-3m-sde recommended)
