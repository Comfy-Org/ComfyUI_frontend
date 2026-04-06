# Wan

Wan is a family of open-source video generation models from Alibaba's Tongyi Lab, spanning text-to-video, image-to-video, speech-to-video, motion control, and video editing. All models are released under the Apache 2.0 license.

## Model Variants

### Wan 2.1 T2V / I2V

- Text-to-video and image-to-video generation
- Available in 1.3B and 14B parameter sizes
- Supports 480p and 720p output, variable aspect ratios
- Chinese and English visual text generation

### Wan 2.1 Fun (Control / InPaint / Camera)

- Camera control with predefined or custom camera movements
- Video inpainting for targeted frame-level editing
- Depth, pose, and canny edge control for guided generation

### Wan 2.1 VACE (Video Any-Condition Editing)

- All-in-one model for video creation and editing (ICCV 2025)
- Reference-to-video (R2V), video-to-video (V2V), and masked editing (MV2V)
- Supports inpainting, outpainting, first-last-frame interpolation, and animate-anything
- Available in 1.3B and 14B sizes, built on Wan 2.1 base models

### Wan 2.2 T2V / I2V / TI2V

- Mixture-of-Experts (MoE) architecture with high-noise and low-noise expert models
- T2V-A14B and I2V-A14B (14B MoE), TI2V-5B (hybrid text+image-to-video)
- Cinematic-level aesthetic control with lighting, composition, and color tone guidance
- TI2V-5B uses a high-compression 16×16×4 VAE, runs on consumer GPUs like 4090

### Wan 2.2 S2V (Speech-to-Video)

- Audio-driven cinematic video generation from image + speech + text
- Supports lip-sync, facial expressions, and pose-driven generation
- Generates variable-length videos matching input audio duration

### Wan 2.2 Animate

- Character animation and subject replacement from video + reference image
- Animate mode: transfers motion from reference video onto a still character
- Replace mode: swaps subjects while preserving background, lighting, and camera motion
- Includes relighting LoRA for scene-matched lighting adaptation

### Wan Move

- Point-level motion control for image-to-video generation (NeurIPS 2025)
- Dense trajectory-based guidance for fine-grained object motion
- Latent trajectory propagation without extra motion modules
- 14B model generating 5-second 480p videos

## Key Features

- High temporal consistency and natural physics simulation
- Multiple aspect ratios (16:9, 9:16, 1:1) at 24fps
- MoE architecture in 2.2 for higher quality at same compute cost
- Bilingual prompt support (Chinese and English)
- ComfyUI and Diffusers integration across all variants

## Hardware Requirements

- 1.3B models: 8GB VRAM minimum
- 14B models: 24GB+ VRAM recommended (80GB for full precision)
- TI2V-5B: runs on consumer 4090 GPUs at 720p
- FP8 quantization available for lower VRAM configurations
- Multi-GPU inference supported via FSDP + DeepSpeed Ulysses

## Common Use Cases

- Social media and short-form video content
- Character animation and motion transfer
- Video inpainting and scene editing
- Product animation and marketing videos
- Speech-driven talking head generation
- Storyboard-to-video conversion

## Key Parameters

- **frames**: Number of output frames (typically 81 for ~3.4s at 24fps)
- **steps**: Inference steps (20-50 recommended)
- **cfg_scale**: Guidance scale for prompt adherence (3-7 typical)
- **size**: Output resolution (480p or 720p)
- **model_name**: Selects variant (e.g., vace-14B, ti2v-5B, s2v-14B)

## Blog References

- [Wan 2.1 Video Model Native Support](../blog/wan21-video-model-native-support.md) — Initial release with 4 model variants, 8.19GB VRAM minimum
- [Wan 2.1 VACE Native Support](../blog/wan21-vace-native-support.md) — Unified video editing: Move/Swap/Reference/Expand/Animate Anything
- [Wan 2.2 Day-0 Support](../blog/wan22-day-0-support.md) — MoE architecture, Apache 2.0 license, cinematic controls
- [WAN 2.6 Reference-to-Video](../blog/wan26-reference-to-video.md) — Generate videos from reference clips at up to 1080p
- [The Complete AI Upscaling Handbook](../blog/upscaling-handbook.md) — Wan 2.2 used for creative video upscaling
