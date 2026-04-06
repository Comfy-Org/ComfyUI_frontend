# FlashVSR

FlashVSR is a diffusion-based streaming video super-resolution framework that achieves near real-time 4× upscaling through one-step inference with locality-constrained sparse attention.

## Model Variants

### FlashVSR v1

- Initial release of the one-step streaming VSR model
- Built on Wan2.1 1.3B video diffusion backbone
- 4× super-resolution optimized

### FlashVSR v1.1

- Enhanced stability and fidelity over v1
- Improved artifact handling across different aspect ratios
- Recommended for production use

## Key Features

- One-step diffusion inference (no multi-step denoising required)
- Streaming architecture with KV cache for sequential frame processing
- Locality-Constrained Sparse Attention (LCSA) prevents artifacts at high resolutions
- Tiny Conditional Decoder (TC Decoder) achieves 7× faster decoding than standard WanVAE
- Three-stage distillation pipeline from multi-step to single-step inference
- Runs at ~17 FPS for 768×1408 videos on a single A100 GPU
- Up to 12× speedup over prior one-step diffusion VSR models
- Scales reliably to ultra-high resolutions

## Hardware Requirements

- Minimum: 24GB VRAM (A100 or similar recommended)
- Optimized for NVIDIA A100 GPUs
- Significant VRAM required for high-resolution video processing
- Multi-GPU inference not required but beneficial for throughput

## Common Use Cases

- Real-world video upscaling to 4K
- AI-generated video enhancement and artifact removal
- Long video super-resolution with temporal consistency
- Streaming video quality improvement
- Restoring compressed or low-resolution video footage

## Key Parameters

- **scale**: Upscaling factor (4× recommended for best results)
- **tile_size**: Spatial tiling for memory management (0 = auto)
- **input_resolution**: Source video resolution (outputs 4× larger)
- **model_version**: v1 or v1.1 checkpoint selection
