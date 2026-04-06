# Grok (Aurora)

Aurora is xAI's autoregressive image generation model integrated into Grok, excelling at photorealistic rendering and precise text instruction following.

## Model Variants

### grok-2-image-1212

- API-accessible image generation model
- Generates multiple images from text prompts
- $0.07 per generated image
- OpenAI and Anthropic SDK compatible

### Aurora (Consumer)

- Autoregressive mixture-of-experts network
- Trained on billions of text and image examples
- Available via Grok on X platform, web, iOS, and Android

### Grok Imagine

- Video and image generation model
- State-of-the-art quality across cost and latency
- API available since January 2026

## Key Features

- Photorealistic image generation from text prompts
- Precise text rendering within images
- Accurate rendering of real-world entities, logos, and text
- Image editing via uploaded photos with text instructions
- Multi-image generation per request
- Native multimodal input support

## Hardware Requirements

- Cloud API-based (no local GPU required)
- All generation runs on xAI infrastructure
- API access via console.x.ai

## Common Use Cases

- Photorealistic image generation
- Text and logo rendering in images
- Image editing and style transfer
- Meme and social media content creation
- Product visualization
- Character and portrait generation

## Key Parameters

- **prompt**: Text description of desired image
- **model**: Model identifier (grok-2-image-1212)
- **n**: Number of images to generate
- **response_format**: Output format (url or b64_json)
- **size**: Image dimensions
