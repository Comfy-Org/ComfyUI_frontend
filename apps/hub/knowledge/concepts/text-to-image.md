# Text-to-Image Generation

Text-to-image is the foundational workflow in ComfyUI: you provide a text description (prompt) and the system generates an image from scratch. This is the starting point for most generative AI art. A diffusion model iteratively denoises a random latent image, guided by your text prompt encoded through CLIP, to produce a coherent image matching your description.

## How It Works in ComfyUI

- Key nodes involved: `CheckpointLoaderSimple`, `CLIPTextEncode` (positive + negative), `EmptyLatentImage`, `KSampler`, `VAEDecode`, `SaveImage`
- Typical workflow pattern: Load checkpoint → encode text prompts → create empty latent → sample → decode latent to image → save

## Key Settings

- **Resolution**: Must match the model's training resolution. Use 512×512 for SD 1.5, 1024×1024 for SDXL and Flux models. Mismatched resolutions produce artifacts like duplicated limbs or distorted compositions.
- **Steps**: Number of denoising iterations. 20–30 steps is a good balance between quality and speed. More steps refine details but with diminishing returns beyond 30.
- **CFG Scale**: Controls how strongly the sampler follows your prompt. 7–8 is the typical range. Higher values increase prompt adherence but can introduce oversaturation or artifacts.
- **Seed**: Determines the initial random noise. A fixed seed produces reproducible results, which is useful for iterating on prompts while keeping composition consistent.

## Tips

- Start with simple, descriptive prompts before adding stylistic modifiers. Complex prompts can conflict and produce muddy results.
- Use the negative prompt `CLIPTextEncode` to specify what you want to avoid (e.g., "blurry, low quality, deformed hands") — this significantly improves output quality.
- Always match your `EmptyLatentImage` resolution to the model you loaded. A 768×768 image on an SD 1.5 checkpoint will produce noticeably worse results than 512×512.
