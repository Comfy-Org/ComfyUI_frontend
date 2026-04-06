# Chroma

Chroma is an open-source 8.9 billion parameter text-to-image model based on the FLUX.1-schnell architecture, developed by Lodestone Rock and the community. It is fully Apache 2.0 licensed.

## Model Variants

### Chroma

- 8.9B parameter model based on FLUX.1-schnell
- Trained on a curated 5M sample dataset (from 20M candidates)
- Apache 2.0 license for unrestricted use
- Supports both tag-based and natural language prompting

### Chroma XL

- Experimental merge and fine-tune based on NoobAI-XL (SDXL architecture)
- Low CFG (2.5-3.0) and low step count (8-12 steps)
- Optimized for fast generation on consumer hardware

## Key Features

- Fully open-source with Apache 2.0 licensing
- Diverse training data spanning anime, artistic, and photographic styles
- Community-driven development with public training logs
- Compatible with FLUX ecosystem (VAE, T5 text encoder)
- ComfyUI workflow support
- LoRA and fine-tuning compatible
- GGUF quantized versions available for lower VRAM

## Hardware Requirements

- Base model: 24GB VRAM recommended (BF16)
- Q8_0 quantized: ~13GB VRAM
- Q4_0 quantized: ~7GB VRAM
- Requires FLUX.1 VAE and T5 text encoder

## Common Use Cases

- Open-source text-to-image generation
- Artistic and stylized image creation
- Community model fine-tuning and experimentation
- LoRA training for custom styles and characters

## Key Parameters

- **prompt**: Text description or tag-based prompt
- **steps**: Inference steps (15-30 recommended)
- **cfg_scale**: Guidance scale (1-4, model uses low CFG)
- **resolution**: Output resolution (1024x1024 default)
- **guidance**: Flux-style guidance parameter (around 4)
