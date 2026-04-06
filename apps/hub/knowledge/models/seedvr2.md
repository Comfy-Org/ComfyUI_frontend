# SeedVR2

SeedVR2 is a one-step diffusion-based video restoration model developed by ByteDance Seed and NTU S-Lab, published at ICLR 2026.

## Model Variants

### SeedVR2-3B

- 3B parameter DiT with one-step inference for video and image upscaling
- Available in FP16, FP8, and GGUF quantized formats

### SeedVR2-7B

- 7B parameter model with Sharp variant for maximum detail
- Multi-GPU inference; supports 1080p and 2K on 4x H100-80GB

### SeedVR (Original)

- Multi-step diffusion model (CVPR 2025 Highlight)
- Arbitrary-resolution restoration without pretrained diffusion prior

## Key Features

- One-step inference achieving 10x speedup over multi-step methods
- Adaptive window attention with dynamic sizing for high-resolution inputs
- Adversarial post-training against real data for faithful detail recovery
- ComfyUI integration via official SeedVR2 Video Upscaler nodes
- Apache 2.0 open-source license

## Hardware Requirements

- Minimum: 8-12GB VRAM with GGUF quantization and tiled VAE
- Recommended: 24GB+ VRAM (RTX 4090) for 3B model at 1080p
- High-end: 4x H100-80GB for 7B model at 2K resolution

## Common Use Cases

- Upscaling AI-generated video to 1080p or 4K
- Restoring degraded or compressed video footage
- Image super-resolution and detail recovery

## Key Parameters

- resolution: target shortest-edge resolution (720, 1080, 2160)
- batch_size: frames per batch, must follow 4n+1 formula (5, 9, 13, 17, 21)
- seed: random seed for reproducible generation
- color_fix_type: wavelet, adain, hsv, or none
