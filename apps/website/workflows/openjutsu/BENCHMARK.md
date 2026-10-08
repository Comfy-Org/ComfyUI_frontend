# Openjutsu benchmark

Measured 2026-10-08 (UTC) on deployment `dep-3b5009fe-c93b-4a3e-9879-8e3fee3addc1`,
Build `openjutsu-h3-swap` release `f4ce9bbb` (ComfyUI 0.39.0), one RTX PRO 6000
(96 GB) in US-NE-1. A new model, node version or GPU invalidates these numbers.

GPU seconds are each job's own `started_at` to `completed_at` on the
deployment, on a warm worker: a small warm-up job ran first and the runs went
back to back. Price is $4.54 per GPU-hour, 211 credits to the dollar, so
0.266 credits per GPU-second.

One metered operation: the swap. Every run is 20 steps, `res_multistep` /
`simple`, LoRA strength 1.0, seed 42. Node classes in the job: `BasicGuider`,
`BasicScheduler`, `CLIPLoader`, `CreateVideo`, `GetVideoComponents`,
`KSamplerSelect`, `LoadImage`, `LoadVideo`, `LoraLoaderModelOnly`,
`MiniMaxH3ReferenceToVideo`, `PrimitiveInt`, `RandomNoise`,
`SamplerCustomAdvanced`, `SaveVideo`, `UNETLoader`, `VAEDecode`, `VAELoader`,
`Video Slice`, `VideoFrameSample`. No partner-API node, so no pass-through cost.

## Results

| Run | Canvas                           | Output | GPU s | Cost  | Credits | Per output second |
| --- | -------------------------------- | ------ | ----- | ----- | ------- | ----------------- |
| r11 | 864x480 (16:9, 480p)             | 5.0 s  | 88    | $0.11 | 23      | $0.022, 4.7 cr    |
| r3  | 768x768 (1:1)                    | 5.2 s  | 131   | $0.17 | 35      | $0.032, 6.8 cr    |
| r4  | 1024x768 (4:3)                   | 5.2 s  | 184   | $0.23 | 49      | $0.045, 9.5 cr    |
| r10 | 1344x768 (16:9)                  | 5.0 s  | 244   | $0.31 | 65      | $0.062, 13 cr     |
| r2  | 1344x768 (16:9)                  | 5.2 s  | 256   | $0.32 | 68      | $0.062, 13 cr     |
| r5  | 1536x672 (21:9)                  | 5.2 s  | 257   | $0.32 | 68      | $0.063, 13 cr     |
| r1  | 768x1344 (9:16)                  | 5.2 s  | 447   | $0.56 | 119     | $0.109, 23 cr     |
| r9  | 768x1344 (9:16), repeat of r1    | 5.2 s  | 456   | $0.58 | 121     | $0.111, 23 cr     |
| r8  | 768x1344, `ref_image_size` `max` | 5.2 s  | 630   | $0.79 | 168     | $0.154, 32 cr     |
| r12 | 1344x768 (16:9)                  | 9.4 s  | 689   | $0.87 | 183     | $0.093, 20 cr     |

All ten succeeded. Not counted: a `beta`-scheduler run cancelled at 226 s (the
scheduler was dropped), and one run that failed in 1 s at the source trim
because it asked for 9.417 s of a 9.375 s clip (fixed: the trim is no longer
strict). Warm-up jobs (1 s at 768x768) took 100 to 128 s from cold.

## What the numbers say

- Cost follows canvas area for 1:1, 4:3, 16:9 and 21:9.
- 9:16 took 1.8 times as long as 16:9 at the same area, twice over. The cause
  is not isolated: the 9:16 runs used a different clip and character image.
- Length is worse than linear: 1.9 times the seconds took 2.8 times the GPU
  time (16:9, 5.0 s against 9.4 s). No run longer than 9.4 s was made.
- 480p costs about a third of 768p.

## Limits of this benchmark

- One run per setting, except 9:16 (two). The handoff wants three per tier.
- Inputs were Higgsfield promo reels, which mix before and after footage with
  wipes and hard cuts, and have no sound. They are poor quality tests.
- 1:1, 4:3 and 21:9 forced that canvas onto a 16:9 clip: timing only.
- Source-audio copy-back and sources under 24 fps were not exercised.
- Runs r1 to r9 used the earlier graph (frames rounded down, no final cut);
  r10 to r12 used the current one. The sampling work is the same.

Inputs, graphs, per-run records and videos are outside the repo, in
`~/comfyvibe/projects/comfy_workshop/openjutsu/bench/` (start with its README;
run names here are the ones under `raw/`).

Since these runs the app gained a 480p option and a final resize to the
source's exact shape. Neither changes the sampling work measured here.

No price or free-run allowance is proposed here yet.
