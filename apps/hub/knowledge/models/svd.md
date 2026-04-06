# Stable Video Diffusion

Stable Video Diffusion (SVD) is Stability AI's image-to-video diffusion model that generates short video clips from a single conditioning image. In user studies, SVD was preferred over GEN-2 and PikaLabs for video quality.

## Model Variants

### SVD-XT (25 frames)

- Generates 25 frames at 576x1024 resolution
- Finetuned from the 14-frame SVD base model
- Includes temporally consistent f8-decoder
- Standard frame-wise decoder also available

### SVD (14 frames)

- Original release generating 14 frames
- Foundation for community fine-tunes and extensions
- Same 576x1024 native resolution

## Key Features

- Image-to-video generation from a single still image
- Temporally consistent video output with finetuned decoder
- Preferred over GEN-2 and PikaLabs in human evaluation studies
- SynthID-compatible watermarking enabled by default
- Latent diffusion architecture for efficient generation

## Hardware Requirements

- Minimum: 16GB VRAM
- Recommended: A100 80GB for full quality (tested configuration)
- SVD generation ~100s, SVD-XT ~180s on A100 80GB
- Optimizations available for lower VRAM cards with quality tradeoffs

## Common Use Cases

- Animating still images into short video clips
- Product visualization and motion graphics
- Creative video experiments and art
- Research on generative video models

## Key Parameters

- **num_frames**: 14 (SVD) or 25 (SVD-XT)
- **resolution**: 576x1024 native
- **conditioning_frame**: Input image at same resolution
- **duration**: Up to ~4 seconds (25 frames)

## Limitations

- Short videos only (4 seconds maximum)
- No text-based control (image conditioning only)
- Cannot render legible text in output
- Faces and people may not generate properly
- May produce videos without motion or with very slow camera pans
