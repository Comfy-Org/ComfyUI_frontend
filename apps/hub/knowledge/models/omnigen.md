# OmniGen2

OmniGen2 is a multimodal generation model with dual decoding pathways for text and image, built on the Qwen-VL-2.5 foundation by VectorSpaceLab.

## Model Variants

### OmniGen2

- 3B vision-language encoder (Qwen-VL-2.5) + 4B image decoder
- Dual decoding with unshared parameters for text and image
- Decoupled image tokenizer
- Apache 2.0 license

### OmniGen v1

- Earlier single-pathway architecture
- Fewer capabilities than OmniGen2
- Superseded by OmniGen2

## Key Features

- Text-to-image generation with high fidelity and aesthetics
- Instruction-guided image editing (state-of-the-art among open-source models)
- In-context generation combining multiple reference inputs (humans, objects, scenes)
- Visual understanding inherited from Qwen-VL-2.5
- CPU offload support reduces VRAM usage by nearly 50%
- Sequential CPU offload available for under 3GB VRAM (slower inference)
- Supports negative prompts and configurable guidance scales

## Hardware Requirements

- Minimum: NVIDIA RTX 3090 or equivalent (~17GB VRAM)
- With CPU offload: ~9GB VRAM
- With sequential CPU offload: under 3GB VRAM (significantly slower)
- Flash Attention optional but recommended for best performance
- CUDA 12.4+ recommended
- Default output resolution: 1024x1024

## Common Use Cases

- Text-to-image generation
- Instruction-based photo editing
- Subject-driven image generation from reference photos
- Multi-image composition and in-context editing

## Key Parameters

- **text_guidance_scale**: Controls adherence to text prompt (CFG)
- **image_guidance_scale**: Controls similarity to reference image (1.2-2.0 for editing, 2.5-3.0 for in-context)
- **num_inference_step**: Diffusion steps (default 50)
- **max_pixels**: Maximum total pixel count for input images (default 1024x1024)
- **negative_prompt**: Text describing undesired qualities (e.g., "blurry, low quality, watermark")
- **scheduler**: ODE solver choice (euler or dpmsolver++)
