# Kling

Kling is a video and image generation platform developed by Kuaishou Technology. It offers text-to-video, image-to-video, video editing, audio generation, and virtual try-on capabilities through both a creative studio and a developer API.

## Model Variants

### Kling O1

- First unified multimodal video model combining generation and editing
- Built on Multimodal Visual Language (MVL) framework
- Accepts text, image, video, and subject inputs in a single prompt
- Supports video inpainting, outpainting, style re-rendering, and shot extension
- Character and scene consistency via Element Library with director-like memory
- Generates 3-10 second videos at up to 2K resolution

### Kling 2.6

- Simultaneous audio-visual generation in a single pass
- Produces video with speech, sound effects, and ambient sounds together
- Supports Chinese and English voice generation
- Video content up to 10 seconds with synchronized audio
- Deep semantic alignment between audio and visual dynamics

### Kling (Base Models)

- Text-to-video and image-to-video with Standard and Professional modes
- Multi-image-to-video with multiple reference inputs
- Camera control with 6 basic movements and 4 master shots
- Video extension, lip-sync, and avatar generation
- Start and end frame generation for controlled transitions

## Key Features

- Unified generation and editing in a single model (O1)
- Simultaneous audio-visual generation (2.6)
- Multi-subject consistency across shots and angles
- Conversational editing via natural language prompts
- Video effects center for special effects and transformations
- Virtual try-on and image recognition capabilities
- DeepSeek integration for prompt optimization

## Hardware Requirements

- Cloud API only; no local hardware required
- Accessed via klingai.com creative studio or API platform
- Standard and Professional generation modes (speed vs. quality tradeoff)

## Common Use Cases

- Film and television pre-production and shot generation
- Social media content creation with audio
- E-commerce product videos and virtual try-on
- Advertising with one-click ad generation
- Video post-production editing via text prompts
- Multi-character narrative video creation

## Key Parameters

- **prompt**: Text description with positive and negative prompts
- **mode**: Standard (fast) or Professional (high quality)
- **duration**: Video length (3-10 seconds for O1, up to 10s for 2.6)
- **aspect_ratio**: Width-to-height ratio for output
- **camera_control**: Predefined camera movements and master shots
- **creativity_strength**: Balance between reference fidelity and creative variation
