# Hunyuan

Hunyuan is Tencent's family of open-source generative models spanning text-to-image, text-to-video, and 3D asset generation.

## Model Variants

### Hunyuan-DiT

- Text-to-image diffusion transformer with native Chinese and English support
- 1.5B parameter DiT architecture, native 1024x1024 resolution
- Bilingual text encoder for strong CJK text rendering in images
- v1.2 is the latest version with improved quality

### HunyuanVideo

- Large-scale text-to-video and image-to-video generation model
- 13B+ parameters, the largest open-source video generation model
- Dual-stream to single-stream transformer architecture with full attention
- MLLM text encoder (decoder-only LLM) for better instruction following
- Causal 3D VAE with 4x temporal, 8x spatial, 16x channel compression
- Generates 720p video (1280x720) at up to 129 frames (~5s at 24fps)
- FP8 quantized weights available to reduce memory by ~10GB
- Outperforms Runway Gen-3, Luma 1.6 in professional evaluations
- 3 workflow templates available

### Hunyuan3D 2.0

- Image-to-3D and text-to-3D asset generation system
- Two-stage pipeline: Hunyuan3D-DiT (shape) + Hunyuan3D-Paint (texture)
- Flow-based diffusion transformer for geometry generation
- High-resolution texture synthesis with geometric and diffusion priors
- Outputs textured meshes in GLB/OBJ format
- Outperforms both open and closed-source 3D generation models
- 7 workflow templates available

## Key Features

- Native bilingual support (Chinese and English) across the family
- Strong text rendering in generated images (Hunyuan-DiT)
- State-of-the-art video generation quality (HunyuanVideo)
- End-to-end 3D asset creation with texturing (Hunyuan3D)
- Multi-resolution generation across all model types
- Prompt rewrite system for improved generation quality (HunyuanVideo)

## Hardware Requirements

- Hunyuan-DiT: 11GB VRAM minimum (fp16), 16GB recommended
- HunyuanVideo 540p (544x960): 45GB VRAM minimum
- HunyuanVideo 720p (720x1280): 60GB VRAM minimum, 80GB recommended
- HunyuanVideo FP8: Saves ~10GB compared to fp16 weights
- Hunyuan3D 2.0: 16-24GB VRAM for shape + texture pipeline

## Common Use Cases

- Bilingual content creation and marketing materials
- Asian-style artwork and illustrations
- Text-in-image generation (Chinese/English)
- High-quality video generation from text or image prompts
- 3D asset creation for games, design, and prototyping
- Textured mesh generation from reference images

## Key Parameters

- **steps**: 25-50 for Hunyuan-DiT (default 40), 50 for HunyuanVideo
- **cfg_scale**: 5-8 for DiT (6 typical), 6.0 embedded for HunyuanVideo
- **flow_shift**: 7.0 for HunyuanVideo flow matching scheduler
- **video_length**: 129 frames for HunyuanVideo (~5s at 24fps)
- **resolution**: 1024x1024 for DiT, 720x1280 or 544x960 for video
- **negative_prompt**: Recommended for Hunyuan-DiT quality control

## Blog References

- [HunyuanVideo Native Support](../blog/hunyuanvideo-native-support.md) — 13B parameter video model, dual-stream transformer, MLLM text encoder
- [HunyuanVideo 1.5 Native Support](../blog/hunyuanvideo-15-native-support.md) — Lightweight 8.3B model, 720p output, runs on 24GB consumer GPUs
- [Hunyuan3D 2.0 and MultiView Native Support](../blog/hunyuan3d-20-native-support.md) — 3D model generation with PBR materials, 1.1B parameter multi-view model
