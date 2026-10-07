# Openjutsu workflow contract

Version `openjutsu/1`, written 2026-10-07. **Not yet run as Openjutsu.** The
graph is Character Swap's `video.api.json` (branch `rob/app-character-swap`,
validated on Comfy Cloud on 2026-09-29, job `b4e641c5`) with three changes: a
trim start, 20 steps instead of 28, and its own output prefix. Nothing here has
been benchmarked; see "Open before a paid run".

The graph is `src/lib/workshop/openjutsu/swap.api.json`, filled in by
`workflow.ts` beside it. Every node is built into ComfyUI; no custom node pack.

## What it does

One job: swap one person in a 3 to 14.4 second part of a clip for the character
in one image, keep the scene, and put the clip's own sound back on the result.

## Sources

- [LoRA model card](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
  and its example workflow `examples/H3 Character Swap v1 Ref2VA.json`.
- [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3) and the
  official `video_minimax_h3_r2v` template the example is built on.
- [Reference Space](https://huggingface.co/spaces/hugging-apps/minimax-h3-character-swap-lora),
  for reference order, canvases and the frame grid.

## Models and why

| Slot            | File                                                       | Why                                                                                      |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Diffusion model | `minimax_h3_ref2va_pruned_int8_convrot`                    | The exact weights the LoRA was trained on. Plain FL2VA/T2V weights are not a substitute. |
| LoRA            | `h3_character_swap_pro4500_1000`, model only, strength 1.0 | The card's stated starting point. It is an adapter, not a Turbo LoRA.                    |
| Text encoder    | `qwen3vl_32b_minimax_h3_nvfp4_awq`, type `minimax`         | The one the example ships; needs no special GPU.                                         |
| Video VAE       | `minimax_h3_video_vae_fp16`                                | What Comfy Cloud has. The example uses the `int8_convrot` build of the same VAE.         |
| Audio VAE       | `minimax_h3_audio_vae_fp32`                                | Loaded because the conditioning node needs it; its output is not decoded.                |

The LoRA is not in Cloud's model list. `lora_name` is the name it took when
imported into Rob's account, so **a deployment must have the LoRA installed
under a name this graph is then given**.

## Settings and why

| Setting             | Value                                                                | Why                                                                                   |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Sampler / scheduler | `res_multistep` / `simple`                                           | The LoRA author's default.                                                            |
| Steps               | 20                                                                   | The author's default. The reference Space uses 28, and Character Swap passed at 28.   |
| Turbo LoRA          | off                                                                  | The card says none is required; its Turbo result was an experiment.                   |
| Frame rate          | 24 fps                                                               | H3's rate. The graph resamples other rates rather than changing speed.                |
| Length              | `17k + 5` frames, 73 to 345                                          | H3's grid. 73 is the LoRA's training length; 362 would pass 15 s.                     |
| Canvas              | nearest of 1344x768, 768x1344, 768x768, 1024x768, 768x1024, 1536x672 | The LoRA's 768 short edge, matched to the source shape so the shot is not recomposed. |
| `ref_image_size`    | `match`                                                              | The example's value. `max` may hold identity better and costs time.                   |
| Reference order     | image, then video                                                    | The order the LoRA was trained with.                                                  |
| Prompt              | the card's example wording                                           | See `swapPrompt`. The card warns that pushing expressions can suppress the swap.      |
| Sound               | source audio, trimmed to the same part                               | The card's own later reviews did this. H3's generated audio drifted.                  |

## App inputs to graph inputs

| App input              | Graph input                                      |
| ---------------------- | ------------------------------------------------ |
| Video                  | `video.file`                                     |
| Character image        | `character.image`                                |
| Who to replace         | `136.prompt`, through `swapPrompt`               |
| Start of the part      | `trim.start_time` (seconds)                      |
| Length of the part     | `frames.value`; the trim length is `frames / 24` |
| Canvas                 | `136.width`, `136.height`                        |
| Seed (blank draws one) | `129.noise_seed`                                 |

Output: node `out` saves `openjutsu/result_*.mp4` (H.264). `LoadVideo` also
emits a preview of the input under node `video`; the app takes the file whose
name contains `result`.

## Expected failures

- A part that runs past the end of the clip fails at `Video Slice`
  (`strict_duration`); the app keeps the part inside the clip.
- A silent source gives a silent result.
- More than one person and a vague description: the swap may hit the wrong
  person or none. The LoRA was only trained on one-person swaps.
- Hard cuts, long parts and close-up expressions drift; the card says so.
- Remuxing the sound does not repair lip-sync drift.

## Metering

One job, and it is the paid one. There is no free preparation job.

## Licence

The LoRA and H3 are under the MiniMax H3 Community License. Its standard grant
excludes the US, EU, UK and South Korea and describes separate authorisation.
**This needs a decision before anything public.**

## Open before a paid run

1. Steps 20 against 28, and `simple` against `beta` (the H3 template's note
   says `beta` or `normal` can do better with references).
2. `ref_image_size` `match` against `max`.
3. Whether 10 to 14 second parts hold up at all, and what each length costs.
4. The LoRA installed on a deployment, and the name it has there.
