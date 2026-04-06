# LTX-Video

LTX-Video is Lightricks' open-source DiT-based video generation model, the first capable of generating high-quality videos in real-time.

## Model Variants

### LTX-Video 2 (v0.9.7/v0.9.8)

- Major quality upgrade over the original release
- Available in 2B and 13B parameter sizes
- 13B dev: highest quality, requires more VRAM
- 13B distilled: faster inference, fewer steps needed, slight quality trade-off
- 2B distilled: lightweight option for lower VRAM usage
- FP8 quantized versions available for all sizes (13B-dev, 13B-distilled, 2B-distilled)
- Multi-condition generation: condition on multiple images or video segments at specific frames
- Spatial and temporal upscaler models for enhanced resolution and frame rate
- ICLoRA adapters for depth, pose, and canny edge conditioning
- 9 workflow templates available

### LTX-Video 0.9.1/0.9.6

- Original public releases with 2B parameter DiT architecture
- Text-to-video and image-to-video modes
- 768x512 native resolution at 24fps
- 0.9.6 distilled variant: 15x faster, real-time capable, no CFG required
- Foundation for community fine-tunes

## Key Features

- Real-time video generation on high-end GPUs (first DiT model to achieve this)
- Generates 30 FPS video at 1216x704 resolution faster than playback speed
- Multi-condition generation with per-frame image/video conditioning and strength control
- Temporal VAE for smooth, consistent motion
- Multi-scale rendering pipeline mixing dev and distilled models for speed-quality balance
- Latent upsampling pipeline for progressive resolution enhancement

## Hardware Requirements

- 2B model: 12GB VRAM minimum, 16GB recommended
- 2B distilled FP8: 8-10GB VRAM
- 13B model: 24-32GB VRAM (fp16)
- 13B FP8: 16-20GB VRAM
- 13B distilled: less VRAM than 13B dev, ideal for rapid iterations
- 32GB+ system RAM recommended for all variants

## Common Use Cases

- Short-form video content and social media clips
- Image-to-video animation from reference frames
- Video-to-video transformation and extension
- Multi-condition video generation (start/end frame, keyframes)
- Depth, pose, and edge-conditioned video generation via ICLoRA
- Rapid video prototyping and creative experimentation

## Key Parameters

- **num_frames**: Output frame count (divisible by 8 + 1, e.g. 97, 161, 257)
- **steps**: 30-50 for dev models, 8-15 for distilled variants
- **cfg_scale**: 3-5 typical for dev, not required for distilled
- **width/height**: Divisible by 32, best under 720x1280 for 13B
- **denoise_strength**: 0.3-0.5 when using latent upsampler refinement pass
- **conditioning_strength**: Per-condition strength for multi-condition generation (default 1.0)
- **seed**: For reproducible generation

## Blog References

- [LTX-Video 0.9.5 Day-1 Support](../blog/ltx-video-095-support.md) — Commercial license (OpenRail-M), multi-frame control, improved quality
- [LTX-2: Open Source Audio-Video AI](../blog/ltx-2-open-source-audio-video.md) — Synchronized audio-video generation, NVFP4 for 3x speed / 60% less VRAM
