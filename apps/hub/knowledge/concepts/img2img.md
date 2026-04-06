# Image-to-Image

Image-to-image (img2img) transforms an existing image using a text prompt while preserving the original structure and composition. Instead of starting from pure noise, the source image is encoded into latent space and partially noised, then the sampler denoises it guided by your prompt. This lets you restyle photos, refine AI-generated images, or apply creative modifications while keeping the overall layout intact.

## How It Works in ComfyUI

- Key nodes involved: `LoadImage`, `VAEEncode`, `CLIPTextEncode` (positive + negative), `KSampler`, `VAEDecode`, `SaveImage`
- Typical workflow pattern: Load source image → encode to latent with VAE → encode text prompts → sample with partial denoise → decode latent to image → save

## Key Settings

- **Denoise Strength**: The most important setting, ranging from 0.0 to 1.0. Lower values (0.2–0.4) preserve more of the original image with subtle changes. Higher values (0.6–0.8) allow more creative freedom but deviate further from the source. A value of 1.0 effectively ignores the input image entirely.
- **Steps**: Number of sampling steps. 20–30 is typical. Fewer steps may be sufficient at low denoise values since less transformation is needed.
- **CFG Scale**: Controls prompt adherence, same as text-to-image. 7–8 is a standard starting point.

## Tips

- Start with a denoise strength of 0.5 and adjust up or down based on how much change you want. This gives a balanced mix of original structure and new content.
- Your input image resolution should match the model's training resolution. Resize or crop your source image to 512×512 (SD 1.5) or 1024×1024 (SDXL) before loading to avoid quality issues.
- Use img2img iteratively: generate an initial text-to-image result, then refine it with img2img at low denoise to fix details without losing the overall composition.
