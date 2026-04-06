# Video Generation

Video generation creates video content from text prompts (T2V), reference images (I2V), or existing video (V2V) using specialized video diffusion models. Unlike image generation, video models must maintain temporal coherence across frames, ensuring smooth motion and consistent subjects. ComfyUI supports several leading open-source video models including WAN 2.1 and HunyuanVideo, each with their own loader and latent nodes.

## How It Works in ComfyUI

- Key nodes involved: Model-specific loaders (e.g. `WAN` video nodes, `HunyuanVideo` nodes, `LTXVLoader`), `EmptyHunyuanLatentVideo` / `EmptyLTXVLatentVideo`, `KSampler`, `VHS_VideoCombine` (from Video Helper Suite)
- Typical workflow pattern: Load video model → Create empty video latent → KSampler (with video-aware scheduling) → VAE decode → VHS_VideoCombine → Save video

## Key Settings

- **Frame count**: Number of frames to generate. Typically 16–81 frames depending on the model; more frames require more VRAM and time.
- **Resolution**: Often 512×320 or 848×480 for T2V. Higher resolutions need significantly more resources.
- **FPS**: Frames per second for output, typically 8–24. Higher FPS gives smoother motion but requires more frames for the same duration.
- **Motion scale/strength**: Controls the amount of movement in the generated video. Lower values produce subtle motion; higher values produce more dynamic scenes.

## Tips

- Start with fewer frames and lower resolution to test your prompt and settings before committing to a full-quality render.
- Image-to-video (I2V) typically gives better coherence than text-to-video (T2V) because the model has a visual anchor.
- Video Helper Suite (VHS) nodes are essential for loading, previewing, and saving video — install this custom node pack first.
- WAN 2.1 and HunyuanVideo are currently the leading open models for quality video generation in ComfyUI.
