# Qwen

Qwen is Alibaba's family of vision-language and image generation models, spanning visual understanding, image editing, and image generation.

## Model Variants

### Qwen2.5-VL

- Multimodal vision-language model from the Qwen team
- Available in 3B, 7B, and 72B parameter sizes
- Image understanding, video comprehension (1+ hour videos), and visual localization
- Visual agent capabilities: computer use, phone use, dynamic tool calling
- Structured output generation for invoices, forms, and tables
- Dynamic resolution and frame rate training for video understanding
- Optimized ViT encoder with window attention, SwiGLU, and RMSNorm

### Qwen-Image-Edit

- Specialized image editing model with instruction-following
- Supports inpainting, outpainting, style transfer, and content-aware edits
- 11 workflow templates available

### Qwen-Image

- Text-to-image generation model from the Qwen family
- 7 workflow templates available

### Qwen-Image-Layered

- Layered image generation for composable outputs
- Generates images with separate foreground/background layers
- 2 workflow templates available

### Qwen-Image 2512

- Specific variant optimized for particular generation tasks
- 1 workflow template available

## Key Features

- Strong visual understanding with state-of-the-art benchmark results
- Native multi-language support including Chinese and English
- Visual agent capabilities for computer and phone interaction
- Video event capture with temporal segment pinpointing
- Bounding box and point-based visual localization
- Structured JSON output for document and table extraction
- Instruction-based image editing with precise control

## Hardware Requirements

- 3B model: 6-8GB VRAM
- 7B model: 16GB VRAM, flash_attention_2 recommended for multi-image/video
- 72B model: Multi-GPU setup required (80GB+ per GPU)
- Context length: 32,768 tokens default, extendable to 64K+ with YaRN
- Dynamic pixel budget: 256-1280 tokens per image (configurable min/max pixels)

## Common Use Cases

- Image editing based on text instructions
- Visual question answering and image description
- Long video comprehension and event extraction
- Document OCR and structured data extraction
- Visual agent tasks (screen interaction, UI navigation)
- Layered image generation for design workflows
- Text-to-image generation with strong prompt following

## Key Parameters

- **max_new_tokens**: Controls output length for VL model responses
- **min_pixels / max_pixels**: Control image token budget (e.g. 256x28x28 to 1280x28x28)
- **temperature**: Generation diversity for text outputs
- **resized_height / resized_width**: Direct image dimension control (rounded to nearest 28)
- **fps**: Frame rate for video input processing in Qwen2.5-VL

## Blog References

- [Qwen Image Edit 2511 & Qwen Image Layered](../blog/qwen-image-edit-2511.md) — Better character consistency, RGBA layer decomposition, built-in LoRA support
