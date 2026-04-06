# Runway

Runway is a generative AI company producing state-of-the-art video generation models, accessible via API and web interface.

## Model Variants

### Gen-3 Alpha

- Text-to-video and image-to-video at 1280x768, 24fps
- 5 or 10 second output, extendable up to 40 seconds
- Photorealistic human character generation

### Gen-3 Alpha Turbo

- Faster, lower-cost variant (5 credits/sec vs 10)
- Requires input image; supports first, middle, and last keyframes
- Video extension up to 34 seconds total

### Gen-4 Turbo

- Latest generation with improved motion and prompt adherence
- Image reference support and text-to-image (gen4_image)

## Key Features

- Advanced camera controls (Motion Brush, Director Mode)
- C2PA provenance metadata for content authenticity
- Expressive human characters with gestures and emotions
- Wide range of cinematic styles and terminology support

## Hardware Requirements

- API-only access via Runway developer portal
- No local hardware requirements
- Enterprise tier available for higher rate limits

## Common Use Cases

- Film pre-visualization and storyboarding
- Commercial advertisement production
- Social media video content
- Visual effects and motion graphics
- Music video and artistic video creation

## Key Parameters

- **prompt**: Text description guiding video generation
- **duration**: Output length (5 or 10 seconds)
- **ratio**: Aspect ratio (1280:768 or 768:1280)
- **keyframes**: Start, middle, and/or end frame images
