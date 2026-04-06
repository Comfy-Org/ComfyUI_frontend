# NewBie

NewBie image Exp0.1 is a 3.5B parameter open-source text-to-image model built on the Next-DiT architecture, developed by the NewBie-AI community. It is specifically pretrained on high-quality anime data for detailed and visually striking anime-style image generation.

## Model Variants

### NewBie image Exp0.1

- 3.5B parameter DiT model based on Next-DiT architecture
- Uses Gemma3-4B-it as primary text encoder with Jina CLIP v2 for pooled features
- FLUX.1-dev 16-channel VAE for rich color rendering and fine texture detail
- Supports natural language, tags, and XML structured prompts
- Non-commercial community license (Newbie-NC-1.0) for model weights

## Key Features

- Exceptional anime and ACG (Anime, Comics, Games) style generation
- XML structured prompting for improved attribute binding and element disentanglement
- Strong multi-character scene generation with accurate attribute assignment
- ComfyUI integration via dedicated custom nodes
- LoRA training support with community trainer
- Built on research from the Lumina architecture family

## Hardware Requirements

- Minimum: 12GB VRAM (bfloat16 or float16)
- Recommended: 24GB VRAM for comfortable generation
- Requires Gemma3-4B-it and Jina CLIP v2 text encoders
- Python 3.10, PyTorch 2.6.0+, Transformers 4.57.1+

## Common Use Cases

- Anime and illustration generation
- Character design with precise attribute control
- Multi-character scene composition
- Fan art and creative anime artwork

## Key Parameters

- **num_inference_steps**: 28 recommended
- **height/width**: 1024x1024 native resolution
- **prompt_format**: Natural language, tags, or XML structured
- **torch_dtype**: bfloat16 recommended (float16 fallback)
