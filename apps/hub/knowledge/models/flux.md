# Flux

Flux is a family of state-of-the-art text-to-image and image editing models developed by Black Forest Labs (BFL).

## Model Variants

### Flux.1 Schnell

- Ultra-fast inference (1-4 steps)
- 12B parameter rectified flow transformer
- Apache 2.0 license (open source)
- Best for rapid prototyping and real-time applications

### Flux.1 Dev

- High-quality 12B parameter development model
- 20-50 steps for best results
- Non-commercial license for research
- Guidance-distilled for efficient generation

### Flux.1 Pro

- Highest quality Flux.1 outputs via commercial API
- Best prompt adherence and detail

### Flux.2 Dev

- 32B parameter rectified flow transformer
- Unified text-to-image, single-reference editing, and multi-reference editing
- No fine-tuning needed for character/object/style reference
- Up to 4MP photorealistic output with improved autoencoder
- Non-commercial license; quantized versions available for consumer GPUs

### Flux.2 Klein

- Fastest Flux model family — sub-second inference on modern hardware
- **Klein 4B**: ~8GB VRAM, Apache 2.0 license, ideal for edge deployment
- **Klein 9B**: Best quality-to-latency ratio, non-commercial license
- Base (undistilled) variants available for fine-tuning and LoRA training
- Supports text-to-image, single-reference editing, and multi-reference editing

### Flux.1 Kontext

- In-context image generation and editing via text instructions
- Available as Kontext Max (premium), Pro (API), and Dev (open-weights, 12B)
- Character consistency across multiple scenes without fine-tuning
- Typography manipulation and local editing within images

### Flux.1 Fill

- Dedicated inpainting and outpainting model
- Maintains consistency with surrounding image context
- Available as Fill Pro (API) and Fill Dev (open-weights)

### Flux Redux / Canny / Depth

- **Redux**: Image variation generation from reference images
- **Canny**: Edge-detection-based structural conditioning
- **Depth**: Depth-map-based structural conditioning for pose/layout control

## Key Features

- Excellent text rendering in images
- Strong prompt following and instruction adherence
- High resolution output (up to 4MP with Flux.2)
- Multi-reference editing: combine up to 6 reference images
- Consistent style and quality across generations

## Hardware Requirements

- Flux.2 Klein 4B: ~8GB VRAM (consumer GPUs like RTX 4070)
- Flux.2 Klein 9B: ~20GB VRAM
- Flux.1 models: 12GB VRAM minimum (fp16), 24GB recommended
- Flux.2 Dev: 64GB+ VRAM native, FP8 quantized ~40GB
- Quantized and weight-streaming options available for lower VRAM cards

## Common Use Cases

- Text-to-image generation
- Iterative image editing via text instructions
- Character-consistent multi-scene generation
- Inpainting and outpainting
- Style transfer and image variation
- Structural conditioning (canny, depth)

## Key Parameters

- **steps**: 1-4 (Schnell/Klein distilled), 20-50 (Dev/Base)
- **guidance_scale**: 3.5-4.0 typical for Flux.2, 3.5 for Flux.1
- **resolution**: Up to 2048x2048 (Flux.1), up to 4MP (Flux.2)
- **seed**: For reproducible generation
- **prompt_upsampling**: Optional LLM-based prompt enhancement (Flux.2)

## Blog References

- [FLUX.2 Day-0 Support in ComfyUI](../blog/flux2-day-0-support.md) — FLUX.2 with 4MP output, multi-reference consistency, professional text rendering
- [FLUX.2 [klein] 4B & 9B](../blog/flux2-klein-4b.md) — Fastest Flux models, sub-second inference, unified generation and editing
- [The Complete AI Upscaling Handbook](../blog/upscaling-handbook.md) — Benchmarks for upscaling workflows
