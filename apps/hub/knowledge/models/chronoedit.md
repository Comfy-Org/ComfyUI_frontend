# ChronoEdit

ChronoEdit is an image editing framework by NVIDIA that reframes editing as a video generation task, using temporal reasoning to ensure physically plausible and consistent edits.

## Model Variants

### ChronoEdit-14B

- Full 14 billion parameter model for maximum quality
- Built on pretrained video diffusion model architecture
- Requires ~34GB VRAM (38GB with temporal reasoning enabled)

### ChronoEdit-2B

- Compact 2 billion parameter variant for efficiency
- Maintains core temporal reasoning capabilities
- Lower VRAM requirements for broader hardware compatibility

### ChronoEdit-14B 8-Step Distilled LoRA

- Distilled variant requiring only 8 inference steps
- Faster generation with minimal quality loss
- Uses flow-shift 2.0 and guidance-scale 1.0

## Key Features

- Treats image editing as a video generation task for temporal consistency
- Temporal reasoning tokens simulate intermediate editing trajectories
- Ensures physically plausible edits (object interactions, lighting, shadows)
- Two-stage pipeline: temporal reasoning stage followed by editing frame generation
- Prompt enhancer integration for improved editing instructions
- LoRA fine-tuning support via DiffSynth-Studio
- Upscaler LoRA available for super-resolution editing
- PaintBrush LoRA for sketch-to-object editing
- Apache-2.0 license

## Hardware Requirements

- 14B model: 34GB VRAM minimum (38GB with temporal reasoning)
- 2B model: 12GB+ VRAM estimated
- Supports model offloading to reduce peak VRAM
- Linux only (not supported on Windows/macOS)

## Common Use Cases

- Physically consistent image editing (add/remove/modify objects)
- World simulation for autonomous driving and robotics
- Visualizing editing trajectories and reasoning
- Image super-resolution via upscaler LoRA
- Sketch-to-object conversion via PaintBrush LoRA

## Key Parameters

- **prompt**: Text description of the desired edit
- **num_inference_steps**: Denoising steps (default ~50, or 8 with distilled LoRA)
- **guidance_scale**: Prompt adherence strength (default ~7.5, or 1.0 with distilled LoRA)
- **flow_shift**: Flow matching shift parameter (2.0 for distilled LoRA)
- **enable_temporal_reasoning**: Toggle temporal reasoning stage for better consistency
