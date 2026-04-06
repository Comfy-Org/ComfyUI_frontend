# Depth Anything V2

Depth Anything V2 is a monocular depth estimation model trained on 595K synthetic labeled images and 62M+ real unlabeled images, providing robust relative depth maps from single images.

## Model Variants

### Depth-Anything-V2-Small

- Lightweight variant for fast inference
- ViT-S (Small) encoder backbone
- Suitable for real-time applications

### Depth-Anything-V2-Base

- Mid-range variant balancing speed and accuracy
- ViT-B (Base) encoder backbone

### Depth-Anything-V2-Large

- High-accuracy variant for detailed depth maps
- ViT-L (Large) encoder backbone with 256 output features
- Recommended for most production use cases

### Depth-Anything-V2-Giant

- Maximum accuracy variant
- ViT-G (Giant) encoder backbone
- Highest computational requirements

## Key Features

- More fine-grained depth detail than Depth Anything V1
- More robust than V1 and Stable Diffusion-based alternatives (Marigold, Geowizard)
- 10× faster than SD-based depth estimation models
- Trained on large-scale synthetic + real data mixture
- Produces relative (not metric) depth maps by default
- DPT (Dense Prediction Transformer) decoder architecture

## Hardware Requirements

- Small: 2GB VRAM minimum
- Base: 4GB VRAM minimum
- Large: 6GB VRAM recommended
- Giant: 12GB+ VRAM recommended
- CPU inference supported for smaller variants

## Common Use Cases

- Depth map generation for compositing and VFX
- ControlNet depth conditioning for image generation
- 3D scene understanding and reconstruction
- Foreground/background separation
- Augmented reality occlusion
- Video depth estimation for parallax effects

## Key Parameters

- **encoder**: Model size variant (vits, vitb, vitl, vitg)
- **input_size**: Processing resolution (higher = more detail, more VRAM)
- **output_type**: Raw depth array or normalized visualization
