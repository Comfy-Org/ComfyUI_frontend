# VAE (Variational Autoencoder)

The VAE encodes pixel images into a compact latent representation and decodes latents back into pixel images. All diffusion in Stable Diffusion and Flux happens in latent space — the VAE is the bridge between the images you see and the mathematical space where the model actually works. Every generation workflow ends with a VAE decode step to produce a viewable image.

## How It Works in ComfyUI

- Key nodes: `VAEDecode` (latent → image), `VAEEncode` (image → latent), `VAEDecodeTiled` (for large images to avoid out-of-memory errors), `VAELoader` (load a standalone VAE file)
- Typical workflow pattern: Most checkpoints include a built-in VAE, so the `VAEDecode` node can pull directly from the loaded checkpoint. To use a different VAE, add a `VAELoader` node and connect it to `VAEDecode` instead.

## Key Settings

- **tile_size** (for `VAEDecodeTiled`): Size of each tile when decoding in chunks. Default is 512; reduce if you still encounter memory issues
- **VAE choice**: VAE files are model-specific. Use `sdxl_vae.safetensors` for SDXL, `ae.safetensors` for Flux. Place files in `ComfyUI/models/vae/`

## Tips

- If colors look washed out or slightly off, try loading an external VAE — the VAE baked into a checkpoint is not always optimal, especially for community fine-tunes
- Use `VAEDecodeTiled` for images larger than ~2048 px on either side to prevent out-of-memory crashes
- SDXL and Flux each have their own VAE architecture — using the wrong one will produce corrupted output
- When doing img2img or inpainting, the `VAEEncode` node converts your input image into the latent space the model expects
