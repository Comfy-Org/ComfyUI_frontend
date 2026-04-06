# Real-ESRGAN

Real-ESRGAN is a practical image and video super-resolution model that extends ESRGAN with improved training on pure synthetic data for real-world restoration.

## Model Variants

### RealESRGAN_x4plus

- General-purpose 4× upscaling model for real-world images
- RRDB (Residual-in-Residual Dense Block) architecture
- Handles noise, blur, JPEG compression artifacts

### RealESRGAN_x4plus_anime_6B

- Optimized for anime and illustration images
- Smaller 6-block model for faster inference
- Better edge preservation for line art

### RealESRGAN_x2plus

- 2× upscaling variant for moderate enlargement
- Lower risk of hallucinated details

### realesr-animevideov3

- Lightweight model designed for anime video frames
- Temporal consistency for video processing

## Key Features

- Trained entirely on synthetic degradation data (no paired real-world data needed)
- Second-order degradation modeling simulates real-world compression chains
- GFPGAN integration for face enhancement during upscaling
- Tiling support for processing large images with limited VRAM
- FP16 (half precision) inference for faster processing
- NCNN Vulkan portable executables for cross-platform GPU support (Intel/AMD/NVIDIA)
- Supports 2×, 3×, and 4× upscaling with arbitrary output scale via LANCZOS4 resize

## Hardware Requirements

- Minimum: 2GB VRAM with tiling enabled
- Recommended: 4GB+ VRAM for comfortable use
- NCNN Vulkan build runs on any GPU with Vulkan support
- CPU inference supported but significantly slower

## Common Use Cases

- Upscaling old or low-resolution photographs
- Enhancing compressed web images
- Anime and manga image upscaling
- Video frame super-resolution
- Restoring degraded historical images
- Pre-processing for print from low-resolution sources

## Key Parameters

- **outscale**: Final upsampling scale factor (default: 4)
- **tile**: Tile size for memory management (0 = no tiling)
- **face_enhance**: Enable GFPGAN face enhancement (default: false)
- **model_name**: Select model variant (RealESRGAN_x4plus, anime_6B, etc.)
- **denoise_strength**: Balance noise removal vs detail preservation (realesr-general-x4v3)
