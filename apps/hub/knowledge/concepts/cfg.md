# CFG / Guidance Scale

Classifier-Free Guidance (CFG) controls how strongly the model follows your text prompt versus generating freely. Higher CFG values produce outputs that adhere more closely to the prompt but can cause oversaturation and artifacts, while lower values yield more natural-looking images at the cost of reduced prompt control. Finding the right balance is essential for every workflow.

## How It Works in ComfyUI

- Key nodes: `KSampler` (the `cfg` parameter), `ModelSamplingDiscrete` (for advanced noise schedule configurations)
- During each sampling step, the model generates both a conditioned prediction (with your prompt) and an unconditioned prediction (without it). CFG scales the difference between the two — higher values push the output further toward the conditioned prediction, amplifying prompt influence.

## Key Settings

- **cfg** (1.0–30.0): The guidance scale value. Recommended ranges vary by model architecture:
  - SD 1.5 / SDXL: 7–8 is the standard starting point
  - Flux: 1.0–4.0 (Flux uses much lower guidance)
  - Video models (e.g., Wan, HunyuanVideo): 3.5–5.0

## Tips

- Start at 7 for SD-based models and 3.5 for Flux, then adjust based on results
- Values above ~12 for SD models typically cause color oversaturation, harsh contrast, and visible artifacts
- Values below ~3 for SD models tend to produce blurry or incoherent results
- Some models like Flux Schnell use a guidance embedding baked into the model rather than traditional CFG — for these, the `cfg` parameter may have little or no effect
- When experimenting, change CFG in increments of 0.5–1.0 to see its impact clearly
