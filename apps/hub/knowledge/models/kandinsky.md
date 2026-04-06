# Kandinsky

Kandinsky is a family of open-source diffusion models for video and image generation, developed by Kandinsky Lab (Sber AI, Russia). The models support both English and Russian text prompts.

## Model Variants

### Kandinsky 5.0 Video Pro (19B)

- HD video at 1280x768, 24fps (5 or 10 seconds)
- Controllable camera motion via LoRA
- Top-1 open-source T2V model on LMArena

### Kandinsky 5.0 Video Lite (2B)

- Lightweight model, #1 among open-source in its class
- CFG-distilled (2x faster) and diffusion-distilled (6x faster) variants
- Best Russian concept understanding in open source

### Kandinsky 5.0 Image Lite (6B)

- HD image output (1280x768, 1024x1024)
- Strong text rendering; image editing variant available

## Key Features

- Bilingual support (English and Russian prompts)
- Flow Matching architecture with MIT license
- Camera control via trained LoRAs
- ComfyUI and Diffusers integration
- MagCache acceleration for faster inference

## Hardware Requirements

- Video Lite: 12GB VRAM minimum with optimizations
- Video Pro: 24GB+ VRAM recommended
- NF4 quantization and FlashAttention 2/3 or SDPA supported

## Common Use Cases

- Open-source video generation research
- Russian and English bilingual content creation
- Camera-controlled video synthesis
- Image generation with text rendering
- Fine-tuning with custom LoRAs

## Key Parameters

- **prompt**: Text description in English or Russian
- **num_frames**: Number of output frames (5s or 10s)
- **resolution**: Output resolution (up to 1280x768)
- **steps**: Inference steps (varies by distillation level)
