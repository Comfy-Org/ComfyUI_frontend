# HiDream-I1

HiDream-I1 is a 17B parameter image generation foundation model by HiDream.ai that achieves state-of-the-art quality using a sparse diffusion transformer architecture.

## Model Variants

### HiDream-I1 Full

- Full 17B parameter sparse diffusion transformer
- Uses Llama-3.1-8B-Instruct and T5-XXL as text encoders
- VAE from FLUX.1 Schnell, MIT license

### HiDream-I1 Dev

- Distilled variant, faster inference with minor quality tradeoff

### HiDream-I1 Fast

- Further distilled for maximum speed, best for rapid prototyping

### HiDream-E1

- Instruction-based image editing model

## Key Features

- State-of-the-art HPS v2.1 score (33.82), surpassing Flux.1-dev, DALL-E 3, and Midjourney V6
- Best-in-class prompt following on GenEval (0.83) and DPG-Bench (85.89)
- Multiple output styles: photorealistic, cartoon, artistic, and more
- Dual text encoding with Llama-3.1-8B-Instruct and T5-XXL for strong prompt adherence
- MIT license for commercial use
- Requires Flash Attention for optimal performance

## Hardware Requirements

- Minimum: 24GB VRAM (Full model), Dev and Fast variants run on lower VRAM
- Recommended: 40GB+ VRAM for Full model at high resolution
- CUDA 12.4+ recommended for Flash Attention
- Llama-3.1-8B-Instruct weights downloaded automatically

## Common Use Cases

- High-fidelity text-to-image generation
- Photorealistic image creation
- Artistic and stylized illustrations
- Instruction-based image editing (E1 variant)
- Commercial image generation

## Key Parameters

- **model_type**: Variant selection (full, dev, fast)
- **steps**: Inference steps (varies by variant; fewer for fast/dev)
- **cfg_scale**: Guidance scale for prompt adherence
- **resolution**: Output image dimensions
- **prompt**: Detailed text description of desired image
