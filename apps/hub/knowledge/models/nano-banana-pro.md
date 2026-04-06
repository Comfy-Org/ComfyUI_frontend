# Nano Banana Pro

Nano Banana Pro is Google DeepMind's flagship image generation and editing model, accessed through ComfyUI's API nodes. Internally it is the Gemini 3 Pro Image model, designed for production-ready high-fidelity visuals.

## Model Variants

### Nano Banana Pro (Gemini 3 Pro Image)

- State-of-the-art reasoning-powered image generation
- Supports up to 14 reference image inputs
- Native 4K output resolution (up to 4096x4096)
- Complex multi-turn image generation and editing
- Model ID: `gemini-3-pro-image-preview`

### Gemini 2.5 Flash Image (Nano Banana)

- Cost-effective alternative optimized for speed
- Balanced price-to-performance for interactive workflows
- Character consistency and prompt-based editing
- Model ID: `gemini-2.5-flash-image`

## Key Features

- **World knowledge**: Generates accurate real-world images using Google Search's knowledge base
- **Text rendering**: Clean text generation with detection and translation across 10 languages
- **Multi-image fusion**: Blend up to 14 input images into a single coherent output
- **Studio controls**: Adjust angles, focus, color grading in generated images
- **Character consistency**: Maintain subject identity across multiple generations
- **Prompt-based editing**: Targeted transformations via natural language instructions

## Hardware Requirements

- No local GPU required — runs as a cloud API service
- Accessed via ComfyUI API nodes (requires ComfyUI login and network access)
- Available on Comfy Cloud or local ComfyUI with API node support

## Common Use Cases

- High-fidelity text-to-image generation
- Multi-reference style transfer and image blending
- Product visualization and mockups
- Sketch-to-image and blueprint-to-3D visualization
- Text rendering and translation in images
- Iterative prompt-based image editing

## Key Parameters

- **prompt**: Text description of desired image or edit
- **aspect_ratio**: Supported ratios include 1:1, 3:2, 4:3, 9:16, 16:9, 21:9
- **temperature**: 0.0-2.0 (default 1.0)
- **topP**: 0.0-1.0 (default 0.95)
- **max_output_tokens**: Up to 32,768 tokens per response
- **input images**: Up to 14 reference images per prompt
