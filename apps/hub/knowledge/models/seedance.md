# Seedance

Seedance is ByteDance's video generation model family, designed for cinematic, high-fidelity video creation from text and images. The 1.0 series established a standard for fluid motion and multi-shot consistency, while the 1.5 series adds native joint audio-visual generation.

## Model Variants

### Seedance 1.5 Pro

- Native audio-visual generation producing video and audio in a single pass
- Multilingual lip-sync supporting English, Mandarin, Japanese, Korean, and Spanish
- 1080p output with 5-12 second duration
- Advanced directorial camera controls (dolly zoom, tracking shots, whip pans)
- Captures micro-expressions, non-verbal cues, and emotional transitions

### Seedance 1.0 Pro

- Production-quality 1080p video generation
- Text-to-video and image-to-video with first and last frame control
- Native multi-shot storytelling with subject and style consistency across cuts
- Cinematic camera grammar interpretation (35mm film, noir lighting, drone shots)
- 2-12 second video duration at 24-30fps

### Seedance 1.0 Pro Fast

- Faster, more cost-effective version of 1.0 Pro
- Same capabilities with reduced generation time

### Seedance 1.0 Lite

- Optimized for speed and iteration at 720p or 1080p
- Lower cost per generation for rapid prototyping

## Key Features

- Smooth, stable motion with wide dynamic range for large-scale movements
- Native multi-shot storytelling maintaining consistency across transitions
- Diverse stylistic expression (photorealism, cyberpunk, illustration, pixel art)
- Precise prompt following for complex actions, multi-agent interactions, and camera work
- Joint audio-visual synthesis with environmental sounds and dialogue (1.5)
- Supports multiple aspect ratios (16:9, 9:16, 1:1, 4:3, 21:9, and more)

## Hardware Requirements

- Cloud API only; no local weights publicly available
- Accessed via seed.bytedance.com, Scenario, fal.ai, and other API providers
- 1080p 5-second video costs approximately $0.62 via fal.ai (Pro)
- Lite version available at lower cost ($0.18 per 720p 5-second video)

## Common Use Cases

- Cinematic shorts and scene previsualization
- Music video concept development
- Product demonstration and marketing videos
- Character-focused animation sequences
- Social media content with audio (1.5)
- Moodboard and style exploration for creative teams

## Key Parameters

- **prompt**: Text description of desired scene, action, and camera work
- **image_url**: Source image for image-to-video generation (first frame)
- **duration**: Video length (2-12 seconds for 1.0, 5-12 seconds for 1.5)
- **resolution**: 480p, 720p, or 1080p output
- **aspect_ratio**: 16:9, 9:16, 1:1, 4:3, 21:9, 9:21
