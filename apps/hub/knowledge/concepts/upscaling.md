# Upscaling

Upscaling increases image resolution while adding detail, turning a small generated image into a large, sharp result. In ComfyUI, there are two main approaches: model-based upscaling, which uses trained AI models (like RealESRGAN or 4x-UltraSharp) to intelligently enlarge an image in one pass, and latent-based upscaling, which works in latent space with a KSampler to add new detail during the enlargement process. Model-based is faster, while latent-based offers more creative control.

## How It Works in ComfyUI

- Key nodes involved: `UpscaleModelLoader`, `ImageUpscaleWithModel`, `ImageScaleBy`, `LatentUpscale`, `VAEDecodeTiled`
- Typical workflow pattern: Generate image → Upscale model loader → ImageUpscaleWithModel → Save image (model-based), or Generate latent → LatentUpscale → KSampler (lower denoise) → VAEDecode → Save image (latent-based)

## Key Settings

- **Upscale model**: The AI model used for model-based upscaling. `RealESRGAN_x4plus` is a reliable general-purpose choice; `4x-UltraSharp` excels at photo-realistic detail.
- **Scale factor**: How much to enlarge — 2x and 4x are typical. Higher factors increase VRAM usage significantly.
- **tile_size**: For tiled decoding/encoding of very large images. Range 512–1024; smaller tiles use less VRAM but take longer.

## Tips

- Model-based upscaling is faster but less creative; latent upscaling paired with a KSampler adds genuinely new detail.
- Use `VAEDecodeTiled` for very large images to avoid out-of-memory errors.
- Chain two 2x upscales instead of one 4x for better overall quality.
- When using latent upscaling, set KSampler denoise to 0.3–0.5 to add detail without changing the composition.
