# Gemini

Gemini is Google DeepMind's multimodal AI model family with native image generation, editing, and video generation capabilities, accessible in ComfyUI through API nodes.

## Model Variants

### Gemini 3 Pro Image Preview

- Most capable Gemini image model with advanced reasoning
- Complex multi-turn image generation and editing
- Up to 14 input images, native 4K output
- Also known as Nano Banana Pro
- Model ID: `gemini-3-pro-image-preview`

### Gemini 2.5 Flash Image

- Cost-effective image generation optimized for speed and low latency
- Character consistency, multi-image fusion, and prompt-based editing
- $0.039 per image (1290 output tokens per image)
- Model ID: `gemini-2.5-flash-image`

### Google Gemini (General)

- Multimodal model for text, image understanding, and generation
- Interleaved text-and-image output in conversational context
- Supports image input for analysis and editing tasks

### Veo 2

- Text-to-video and image-to-video generation
- 8-second video clips at 720p resolution
- Realistic physics simulation and cinematic styles
- Supports 16:9 and 9:16 aspect ratios
- Model ID: `veo-2.0-generate-001`

### Veo 3 / 3.1

- Latest video generation with native audio (dialogue, SFX, ambient)
- Up to 1080p and 4K resolution (Veo 3.1)
- Style reference images for aesthetic control
- 4, 6, or 8-second video duration options

## Key Features

- Native multimodal generation: text, images, and video in one model family
- World knowledge from Google Search for factually accurate image generation
- SynthID invisible watermarking on all generated content
- Multi-image fusion and character consistency across generations
- Clean text rendering across multiple languages
- Prompt-based image editing without masks or complex workflows

## Hardware Requirements

- No local GPU required — all models accessed via cloud API
- Available through ComfyUI API nodes, Google AI Studio, and Vertex AI
- Requires API key and network access

## Common Use Cases

- Text-to-image and image editing via API nodes
- Multi-turn conversational image generation
- Video generation from text prompts or reference images
- Product animation and social media video content
- Style-consistent character and brand asset generation
- Text rendering and translation in images

## Key Parameters

- **prompt**: Text description for generation or editing
- **aspect_ratio**: 1:1, 3:4, 4:3, 9:16, 16:9, 21:9 (images); 16:9, 9:16 (video)
- **temperature**: 0.0-2.0 (default 1.0 for image models)
- **durationSeconds**: 4-8 seconds for Veo models
- **sampleCount**: 1-4 output videos per request
- **seed**: Integer for reproducible generation
- **personGeneration**: Safety control — `allow_adult`, `dont_allow`, or `allow_all`
