# Seedream

Seedream is ByteDance's text-to-image generation model, capable of producing high-quality images with strong text rendering, bilingual support (English and Chinese), and native high-resolution output.

## Model Variants

### Seedream 3.0

- Native 2K resolution output without post-processing
- Bilingual image generation (English and Chinese)
- 3-second end-to-end generation for 1K images
- Improved text rendering for small fonts and long text layouts

### Seedream 4.0

- Unified architecture for text-to-image and image editing
- Native output up to 4K resolution
- Multi-image reference input (up to 6 source images)
- 1.8-second inference for 2K images
- Batch input and output for multiple generations
- Natural language image editing capabilities

## Key Features

- Accurate text rendering in both English and Chinese
- Knowledge-driven generation for educational illustrations and charts
- Strong character consistency across multiple angles
- Prompt-based image editing without separate tools
- Versatile style support from photorealism to anime
- Leading scores on Artificial Analysis Image Arena

## Hardware Requirements

- API-only access via ByteDance Volcano Engine
- No local hardware requirements for end users
- Third-party API providers available (e.g., EvoLink)

## Common Use Cases

- Poster and advertisement design with embedded text
- E-commerce product photography
- Character design with multi-angle consistency
- Educational illustration and infographic generation
- Brand-consistent marketing materials

## Key Parameters

- **prompt**: Text description of the desired image
- **resolution**: Output resolution (up to 4K supported)
- **aspect_ratio**: Supports 16:9, 4:3, 1:1, and custom ratios
