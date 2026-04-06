# Samplers & Schedulers

Samplers are the algorithms that iteratively denoise a random latent into a coherent image, while schedulers control the noise schedule — how much noise is removed at each step. Together they determine the image's quality, speed, and visual character. Choosing the right combination is one of the most impactful decisions in any generation workflow.

## How It Works in ComfyUI

- Key nodes: `KSampler` (main sampling node), `KSamplerAdvanced` (provides control over start/end steps for multi-pass workflows)
- Typical workflow pattern: Load model → connect conditioning → configure sampler/scheduler/steps → sample → decode

## Key Settings

- **sampler_name**: The denoising algorithm. Common choices include `euler` (fast, good baseline), `euler_ancestral` (more creative variation), `dpmpp_2m` (balanced quality and speed), `dpmpp_2m_sde` (high quality, slightly slower), `dpmpp_3m_sde` (very high quality), and `uni_pc` (fast convergence)
- **scheduler**: Controls the noise reduction curve. `normal` is linear, `karras` front-loads noise reduction for better detail, `exponential` and `sgm_uniform` (recommended for SDXL) are also available
- **steps** (1–100): Number of denoising iterations. 20–30 is typical; more steps give diminishing returns. Flux and LCM models need far fewer (4–8 steps)

## Tips

- `euler` + `normal` is the safest starting combination for any model
- `dpmpp_2m` + `karras` is a popular choice when you want higher quality with minimal speed cost
- Ancestral samplers (`euler_ancestral`, any `_sde` variant) produce different results each run even with the same seed — useful for exploration, but not for reproducibility
- Flux and LCM models converge much faster; using 20+ steps with them wastes time without improving quality
