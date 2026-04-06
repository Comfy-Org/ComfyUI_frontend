# HuMo

HuMo is a human-centric video generation model by ByteDance that produces videos from collaborative multi-modal conditioning using text, image, and audio inputs.

## Model Variants

### HuMo (Wan2.1-T2V-1.3B based)

- Built on the Wan2.1-T2V-1.3B video foundation model
- Supports Text+Image (TI), Text+Audio (TA), and Text+Image+Audio (TIA) modes
- Two-stage training: subject preservation then audio-visual sync

## Key Features

- Multi-modal conditioning: text, reference images, and audio simultaneously
- Subject identity preservation from reference images across frames
- Audio-driven lip synchronization with facial expression alignment
- Focus-by-predicting strategy for facial region attention during audio sync
- Time-adaptive guidance dynamically adjusts input weights across denoising steps
- Minimal-invasive image injection maintains base model prompt understanding
- Progressive two-stage training separates identity learning from audio sync
- Supports text-controlled appearance editing while preserving identity

## Hardware Requirements

- Minimum: 24GB VRAM (RTX 3090/4090 or similar)
- Multi-GPU inference supported via FSDP and sequence parallelism
- Whisper-large-v3 audio encoder required for audio modes
- Optional audio separator for cleaner speech input

## Common Use Cases

- Digital avatar and virtual presenter creation
- Audio-driven talking head generation
- Character-consistent video clips from reference photos
- Lip-synced dialogue video from audio tracks
- Prompted reenactment with identity preservation
- Text-controlled outfit and style changes on consistent subjects

## Key Parameters

- **mode**: Generation mode (TI, TA, or TIA)
- **scale_t**: Text guidance strength (default: 7.5)
- **scale_a**: Audio guidance strength (default: 2.0)
- **frames**: Number of output frames (97 at 25 FPS = ~4 seconds)
- **height/width**: Output resolution (480p or 720p supported)
- **steps**: Denoising steps (30-50 recommended)
