# LoRA

LoRA (Low-Rank Adaptation) is a technique for fine-tuning a base model's behavior using a small add-on file rather than retraining the entire model. LoRAs adjust a model's style, teach it specific subjects, or introduce new concepts — all in a file typically just 10–200 MB, compared to multi-gigabyte full checkpoints. This makes them easy to share, swap, and combine. In ComfyUI, you load LoRAs on top of a checkpoint and control how strongly they influence the output.

## How It Works in ComfyUI

- Key nodes involved: `LoraLoader` (loads one LoRA and applies it to both MODEL and CLIP), `LoraLoaderModelOnly` (applies to MODEL only, skipping CLIP for faster loading)
- Typical workflow pattern: Load checkpoint → LoraLoader (attach LoRA) → CLIP Text Encode → KSampler → VAE Decode. Chain multiple `LoraLoader` nodes to stack LoRAs.

## Key Settings

- **strength_model**: Controls how much the LoRA affects the diffusion model. Range 0.0–1.0; typical values are 0.6–1.0. Higher values apply the LoRA effect more strongly.
- **strength_clip**: Controls how much the LoRA affects text encoding. Usually set to the same value as strength_model, but can be adjusted independently for fine control.

## Tips

- Start with strength 0.7 and adjust up or down based on results — too high can cause oversaturation or artifacts.
- Stacking too many LoRAs simultaneously can cause visual artifacts or conflicting styles; two or three is usually a safe limit.
- Ensure the LoRA matches your base model architecture — SD 1.5 LoRAs will not work with SDXL checkpoints, and vice versa.
- Many LoRAs require specific trigger words in your prompt to activate; always check the LoRA's documentation or model card.
