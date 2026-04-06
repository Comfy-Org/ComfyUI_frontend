# Stable Diffusion

Stable Diffusion is Stability AI's family of open-source image and video generation models, spanning multiple architectures from U-Net to diffusion transformers.

## Model Variants

### SDXL (Stable Diffusion XL)

- Stability AI's flagship text-to-image model (6.6B parameter U-Net)
- Native 1024x1024 resolution with flexible aspect ratios around 1MP
- Two text encoders (CLIP ViT-L + OpenCLIP ViT-bigG)
- Optional refiner model for second-stage detail enhancement
- Turbo and Lightning distilled variants for 1-4 step generation
- Largest ecosystem of LoRAs, fine-tunes, and community models

### SD3.5 (Stable Diffusion 3.5)

- Diffusion transformer (DiT) architecture, successor to SDXL
- Three text encoders (CLIP ViT-L, OpenCLIP ViT-bigG, T5-XXL) for stronger prompt following
- Available in Large (8B) and Medium (2B) parameter sizes
- Improved text rendering and compositional accuracy over SDXL
- 4 workflow templates available

### SD1.5 (Stable Diffusion 1.5)

- The classic 512x512 latent diffusion model
- Single CLIP ViT-L text encoder, 860M parameter U-Net
- Still widely used for its massive LoRA and checkpoint ecosystem
- Lower VRAM requirements make it accessible on consumer hardware
- 2 workflow templates available

### SVD (Stable Video Diffusion)

- Image-to-video generation model based on Stable Diffusion
- Generates short video clips (14 or 25 frames) from a single image
- Related model for motion generation from static inputs

### Stability API Products

- Reimagine: Stability's API-based image variation and transformation service

## Key Features

- Excellent composition, layout, and photorealism (SDXL/SD3.5)
- Large open-source ecosystem with thousands of community fine-tunes
- Flexible aspect ratios and multi-resolution support
- Dual/triple CLIP text encoding for nuanced prompt interpretation
- Strong text rendering in SD3.5 via T5-XXL encoder

## Hardware Requirements

- SD1.5: 4-6GB VRAM (fp16), runs on most consumer GPUs
- SDXL Base: 8GB VRAM minimum (fp16), 12GB recommended
- SDXL Base + Refiner: 16GB+ VRAM
- SD3.5 Medium: 8-12GB VRAM
- SD3.5 Large: 16-24GB VRAM (fp16), quantized versions for 12GB cards

## Common Use Cases

- Photorealistic image generation
- Artistic illustrations and concept art
- Product photography and design
- Character and portrait generation
- LoRA-based custom style and subject training
- Image-to-video with SVD

## Key Parameters

- **steps**: 20-40 for SDXL base, 15-25 for refiner, 28+ for SD3.5
- **cfg_scale**: 5-10 (7 default for SDXL), 3.5-7 for SD3.5
- **sampler**: DPM++ 2M Karras and Euler are popular for SDXL; Euler for SD3.5
- **resolution**: 1024x1024 native for SDXL/SD3.5, 512x512 for SD1.5
- **clip_skip**: Often set to 1-2; important for SD1.5 LoRA compatibility
- **denoise_strength**: 0.7-0.8 when using the SDXL refiner (img2img)
- **negative_prompt**: Supported in SDXL/SD1.5; not used in SD3.5 by default
