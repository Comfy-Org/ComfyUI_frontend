# Z-Image

Z-Image is Zhipu AI's image generation model family, built on the CogView architecture with a hybrid autoregressive and diffusion decoder design.

## Model Variants

### GLM-Image (Z-Image)

- 9B autoregressive + 7B DiT diffusion decoder hybrid architecture
- First open-source industrial-grade discrete autoregressive image generator
- State-of-the-art bilingual text rendering (English and Chinese)

### Z-Image-Turbo

- Optimized variant for faster inference with reduced latency
- Suitable for real-time and batch generation workflows

### CogView-4

- 6B parameter DiT diffusion model, foundation for the Z-Image decoder

## Key Features

- Industry-leading text rendering accuracy for posters and infographics
- Custom resolution from 512px to 2048px (multiples of 32)
- Image editing, style transfer, and identity-preserving generation
- LoRA training support; open weights on HuggingFace

## Hardware Requirements

- Cloud API: no local hardware required ($0.015 per image via Z.ai)
- Self-hosted: 24GB+ VRAM for the combined 9B+7B architecture

## Common Use Cases

- Text-to-image generation with accurate text rendering
- Commercial poster and graphic design
- Social media content creation
- Multi-subject consistency and identity-preserving generation

## Key Parameters

- prompt: text description of the desired image
- size: output resolution (e.g., 1280x1280, 1568x1056, 960x1728)
- model: glm-image or cogview-4
