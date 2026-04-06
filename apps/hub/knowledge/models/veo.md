# Google Veo

Veo is Google DeepMind's state-of-the-art video generation model family, designed for high-quality cinematic video creation with strong prompt adherence and realistic physics simulation.

## Model Variants

### Veo 2

- Text-to-video and image-to-video generation
- Up to 4K resolution output (720p default in VideoFX)
- 8-second clips, extendable to minutes
- State-of-the-art in human preference evaluations against Sora, Kling, and Minimax

### Veo 3 / 3.1

- Latest generation with native audio generation
- Generates sound effects, ambient noise, and dialogue alongside video
- Improved prompt adherence and real-world physics simulation
- 1080p and 4K output support
- Scene extension, first/last frame, and object insertion capabilities

## Key Features

- Cinematic camera control (lens types, angles, depth of field)
- Realistic physics and natural human motion
- SynthID invisible watermarking on all outputs
- Style reference image support for consistent aesthetics
- Reduced hallucination artifacts compared to prior models
- Available via Gemini API and Google AI Studio

## Hardware Requirements

- Cloud API only (Google-hosted infrastructure)
- No local GPU required
- Available through VideoFX, Vertex AI, and Gemini API

## Common Use Cases

- Short-form video content and social media clips
- Product demos and promotional videos
- Cinematic storytelling and filmmaking
- Marketing and advertising video production

## Key Parameters

- **prompt**: Detailed text description with cinematic language
- **aspect_ratio**: 16:9, 9:16, and other formats
- **person_generation**: Control for human figure generation
- **duration**: Up to 8 seconds per clip (Veo 2), extendable in Veo 3.1
