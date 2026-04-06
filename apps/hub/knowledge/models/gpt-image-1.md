# GPT-Image-1

GPT-Image-1 is OpenAI's natively multimodal image generation model, capable of generating and editing images from text and image inputs. It is accessed in ComfyUI through API nodes.

## Model Variants

### GPT-Image-1.5

- Latest and most advanced GPT Image model
- Best overall quality with superior instruction following
- High input fidelity for the first 5 input images
- Supports generate vs. edit action control
- Multi-turn editing via the Responses API

### GPT-Image-1

- Production-grade image generation and editing
- High input fidelity for the first input image
- Supports up to 16 input images for editing
- Up to 10 images per generation request

### GPT-Image-1-Mini

- Cost-effective variant for lower quality requirements
- Same API surface as GPT-Image-1
- Suitable for rapid prototyping and high-volume workloads

## Key Features

- Superior text rendering in generated images
- Real-world knowledge for accurate depictions
- Transparent background support (PNG and WebP)
- Mask-based inpainting with prompt guidance
- Multi-image editing: combine up to 16 reference images
- Streaming partial image output during generation
- Content moderation with adjustable strictness

## Hardware Requirements

- No local GPU required — cloud API service via OpenAI
- Accessed through ComfyUI API nodes
- Requires OpenAI API key and organization verification

## Common Use Cases

- Text-to-image generation with detailed prompts
- Image editing and compositing from multiple references
- Product photography and mockup generation
- Inpainting with mask-guided editing
- Transparent asset generation (stickers, logos, icons)
- Multi-turn iterative image refinement

## Key Parameters

- **prompt**: Text description up to 32,000 characters
- **size**: `1024x1024`, `1536x1024` (landscape), `1024x1536` (portrait), or `auto`
- **quality**: `low`, `medium`, `high`, or `auto` (affects cost and detail)
- **n**: Number of images to generate (1-10)
- **background**: `transparent`, `opaque`, or `auto`
- **output_format**: `png`, `jpeg`, or `webp`
- **moderation**: `auto` (default) or `low` (less restrictive)
- **input_fidelity**: `low` (default) or `high` for preserving input image details
