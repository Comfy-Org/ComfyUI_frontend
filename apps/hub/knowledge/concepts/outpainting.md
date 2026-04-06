# Outpainting

Outpainting extends an image beyond its original borders, generating new content that seamlessly continues the existing scene. Unlike inpainting which replaces content within an image, outpainting adds content outside the frame — expanding the canvas in any direction. This is useful for changing aspect ratios, adding environmental context, or creating panoramic compositions from a single image.

## How It Works in ComfyUI

- Key nodes involved: `LoadImage`, `ImagePadForOutpaint`, `VAEEncodeForInpainting`, `CLIPTextEncode` (positive + negative), `KSampler`, `VAEDecode`, `SaveImage`
- Typical workflow pattern: Load image → pad image with transparent/noised borders → encode with inpainting VAE node (padded area becomes the mask) → encode text prompts → sample → decode → save

## Key Settings

- **Padding Pixels**: The number of pixels to extend on each side, typically 64–256. Smaller increments produce more coherent results since the model has more context relative to the new area.
- **Denoise Strength**: Use high values (0.8–1.0) for outpainted regions since the padded area is essentially blank and needs full generation.
- **Feathering**: Controls the gradient blend between the original image and the new content. Higher feathering values create smoother transitions and reduce visible seams.

## Tips

- Outpaint in stages rather than all at once. Extending by 128 pixels at a time and iterating produces far more coherent results than trying to add 512 pixels in a single pass.
- Use a lower CFG scale (5–6) for outpainting. This allows the model to generate more natural, context-aware extensions rather than forcing strict prompt adherence that may clash with the existing image.
- Include scene context in your prompt that matches the original image. If the source shows an indoor room, describe the room's style and lighting so the extension feels continuous.
