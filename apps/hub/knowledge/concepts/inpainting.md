# Inpainting

Inpainting selectively regenerates parts of an image using a mask while leaving the rest untouched. You paint a mask over the area you want to change, provide a text prompt describing the desired replacement, and the model fills in only the masked region. This is essential for fixing defects, replacing objects, or refining specific details in an otherwise finished image.

## How It Works in ComfyUI

- Key nodes involved: `LoadImage`, `VAEEncodeForInpainting`, `CLIPTextEncode` (positive + negative), `KSampler`, `VAEDecode`, `SaveImage`
- Typical workflow pattern: Load image + mask → encode with inpainting-aware VAE node → encode text prompts → sample → decode → save
- The mask can be created using ComfyUI's built-in mask editor or loaded from an external image

## Key Settings

- **grow_mask_by**: Expands the mask by a number of pixels, helping the regenerated area blend smoothly with the surrounding image. 6–8 pixels is typical. Too little causes visible seams; too much affects areas you wanted to keep.
- **Denoise Strength**: For inpainting, higher values (0.7–1.0) generally work best since you want the masked region to be fully regenerated. Lower values may produce inconsistent blending.
- **Checkpoint**: Dedicated inpainting models like `512-inpainting-ema` produce significantly better edge blending than standard checkpoints.

## Tips

- Always expand your mask slightly beyond the target area. Tight masks create hard edges that look unnatural against the surrounding image.
- Describe what you want to appear in the masked region, not what you want to remove. For example, prompt "a clear blue sky" rather than "remove the bird."
- Use inpainting-specific checkpoints whenever possible. Standard models can inpaint but often struggle with seamless blending at mask boundaries.
