# Ovis-Image

Ovis-Image is a 7B text-to-image model by AIDC-AI, built on Ovis-U1, optimized for high-quality text rendering in generated images. It achieves state-of-the-art results on the CVTG-2K text rendering benchmark while remaining compact enough for single-GPU deployment.

## Model Variants

### Ovis-Image-7B

- 2B (Ovis2.5-2B) + 7B parameter architecture
- State-of-the-art on CVTG-2K benchmark for text rendering accuracy
- Competitive with 20B+ models (Qwen-Image) and GPT-4o on text-centric tasks
- Uses FLUX-based autoencoder for latent encoding
- Apache 2.0 license

## Key Features

- Excellent text rendering with correct spelling and consistent typography
- High fidelity on text-heavy, layout-sensitive prompts
- Handles posters, banners, logos, UI mockups, and infographics
- Supports diverse fonts, sizes, and aspect ratios
- Strong performance on both English and Chinese text generation
- Available via Diffusers library with OvisImagePipeline

## Hardware Requirements

- Minimum: 16GB VRAM (bfloat16)
- Recommended: 24GB VRAM for comfortable use
- Fits on a single high-end GPU
- Tested with Python 3.10, PyTorch 2.6.0, Transformers 4.57.1

## Common Use Cases

- Generating posters and banners with accurate text
- Logo and brand asset creation
- UI mockup and infographic generation
- Marketing materials with embedded typography

## Key Parameters

- **num_inference_steps**: 50 recommended
- **guidance_scale**: 5.0
- **resolution**: 1024x1024 native
- **negative_prompt**: Supported for quality control
