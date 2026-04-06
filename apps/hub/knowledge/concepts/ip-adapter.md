# IP-Adapter

IP-Adapter (Image Prompt Adapter) uses reference images to guide generation style, composition, or subject instead of — or alongside — text prompts. Rather than describing what you want in words, you show the model an image, enabling "image prompting." This is especially powerful for transferring artistic style, maintaining character consistency across generations, or conveying visual concepts that are difficult to express in text.

## How It Works in ComfyUI

- Key nodes: `IPAdapterModelLoader`, `IPAdapterApply` (or `IPAdapterAdvanced`), `CLIPVisionLoader`, `CLIPVisionEncode`, `PrepImageForClipVision`
- Typical workflow pattern: Load IP-Adapter model + CLIP Vision model → prepare and encode reference image → apply adapter to the main model → connect to sampler → decode

## Key Settings

- **weight** (0.0–1.0): Controls the influence of the reference image on the output. A range of 0.5–0.8 is typical; higher values make the output closer to the reference
- **weight_type**: Determines how the reference is interpreted — `standard` for general use, `style transfer` for artistic style without copying content, `composition` for layout guidance
- **start_at / end_at** (0.0–1.0): Controls when the adapter is active during sampling. Limiting the range (e.g., 0.0–0.8) can improve prompt responsiveness while retaining reference influence

## Tips

- Use the `style_transfer` weight type when you want to borrow an artistic style without reproducing the reference image's content
- Combine IP-Adapter with a text prompt for the best results — the text adds detail and specificity on top of the visual guidance
- Face-specific IP-Adapter models (e.g., `ip-adapter-faceid`) exist for portrait consistency across multiple generations
- Lower the weight if your output looks too similar to the reference image
