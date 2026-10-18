# Openjutsu workflow contract

Version `openjutsu/2`, written 2026-10-17. It replaces `openjutsu/1`, the
core-nodes-only graph built on `MiniMaxH3ReferenceToVideo`.

The graph is `src/lib/workshop/openjutsu/swap.api.json`, filled in by
`workflow.ts` beside it. It is Akatz Labs' H3 Character Swap workflow
(`akatz-labs/h3-character-swap-tool`, `workflows/H3 Character Swap.api.json` at
`0670e4f`, node for node the same as the canvas file there) with the changes
listed under "Changes from upstream". It is generated, not hand-edited: the
build script and upstream copy live outside the repo, in
`~/comfyvibe/projects/comfy_workshop/openjutsu-v2/h3-character-swap/`
(`make_graph.py`).

Workspace: Comfy. Build `app-openjutsu` (`ce9cd4e1-ab34-411c-aa5e-625d1835cb5d`),
release `9e2ed871-78e4-4103-be56-8d2f31097011` (v4), ComfyUI `v0.41.0`
(`98cc0bf8`), PyTorch 2.12.1 + CUDA 13.0. Deployment
`dep-1addaa09-5d25-4247-af0e-a79c57f7797a`, RTX PRO 6000, US-NE-1, 0 to 1
workers. The spec is outside the repo:
`~/comfyvibe/projects/comfy_workshop/openjutsu-v2/build-comfy/comfy-build.yaml`.
The build only ever adds: `openjutsu/1`'s models and nodes stay installed.

## What it does

One job: swap the most prominent person in a chosen 5 to 15 second part of a
video for the character in one image, keep the scene, and keep the clip's own
sound. A SAM 3.1 mask limits the change to that person; the run generates in
124-frame windows with 18 frames of history, so any part length up to 15 s is
one job.

## Custom nodes

`h3_character_swap`, Akatz Labs' node pack (`worker_nodes/h3_character_swap`
in the same repo at `0670e4f`), installed as a private copy because it lives in
a subfolder of a larger repo. GPL-3.0, with one Apache-2.0 kernel file. The
copy carries two Comfy patches, recorded in its `SOURCE_PROVENANCE.json`:

- FFmpeg: the build image has no `ffmpeg` or `ffprobe` on PATH. The pack puts
  the bundled `imageio-ffmpeg` binary on PATH and reads stream facts with PyAV
  instead of `ffprobe`.
- `H3CharacterSwapPrepareVideo.resolution` takes the integers `480` and `768`
  instead of strings, so the app proxy can price on it as a numeric tier.

## Models

| Slot             | File                                                                 | Licence                      |
| ---------------- | -------------------------------------------------------------------- | ---------------------------- |
| Diffusion model  | `minimax_h3_ref2va_pruned_int8_convrot`                              | MiniMax H3 Community License |
| Turbo LoRA       | `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16`, strength 1.0   | Apache-2.0                   |
| Swap LoRA        | `h3_character_swap_v1.5`, strength 1.0 (Akatz's recommended release) | MiniMax H3 Community License |
| Text encoder     | `qwen3vl_32b_minimax_h3_nvfp4_awq`, type `minimax`                   | MiniMax H3 Community License |
| Video, audio VAE | `minimax_h3_video_vae_fp16`, `minimax_h3_audio_vae_fp32`             | MiniMax H3 Community License |
| Segmentation     | `sam3.1_multiplex_fp16`                                              | SAM License                  |

## Settings

Upstream's, unchanged: 8 steps, CFG 1, `er_sde` / `normal`, sigma shift 12
(video) and 3 (audio), Comfy Kitchen attention, 124-frame windows with 18
frames of history, a 64 px mask expansion, SAM `person` with the largest
person selected, audio guide on.

## Changes from upstream

| Change                                                   | Why                                                                                                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swap LoRA v1 to `h3_character_swap_v1.5`                 | Akatz's recommended release.                                                                                                                                                                 |
| `Video Slice` (`trim`) in front of nodes 31 and 803      | The page chooses where the part starts.                                                                                                                                                      |
| `resolution` as a number, `duration_seconds` always set  | The app proxy prices from both; it refuses `0` (whole clip).                                                                                                                                 |
| The optional anchor (309) replaced by `LoadImage` + crop | The deployment rejects uploaded files in node 309's own validation; core `LoadImage` takes them. `ImageScale` center-crops the anchor to the prepared size, since node 803 would stretch it. |
| `CreateVideo` + `SaveVideo` after node 807               | The deployment reports only standard outputs; 807 reports its MP4 under its own key.                                                                                                         |
| Mask preview (111, 112) removed                          | Not needed by the app.                                                                                                                                                                       |
| Prompt                                                   | See below.                                                                                                                                                                                   |

## Prompt

Every run sends upstream's instruction with H3's reference tags, then the
visitor's optional "extra direction":

> Replace the selected person in `<Video 1>` with the character in
> `<Picture 1>`. Preserve the source performance, scene and audio timing.
> _(with an anchor:)_ Start from the first frame in `<Picture 2>`.
> _(the visitor's text, if any)_

The box is optional; it is for character details or for fixing a previous take.

## Anchor

Before the job, the page makes a first-frame anchor: it takes the frame at the
part's start from the visitor's own video, and asks GPT Image 2.5 sunburst
(quality `low`, through Comfy Router with the visitor's sign-in) to put the
character, outfit included, into it. The page uploads the result with the
other files and the graph uses it through `anchor_image` and `anchor_fit`.
If making it fails, or nobody is signed in, the job runs without an anchor
(the page removes both nodes and sets `use_anchor` false). See `anchor.ts`.

The anchor is a separate Router charge on the visitor's credits, about 7
credits, not part of the app proxy's price.

## App inputs to graph inputs

| App input                    | Graph input                                               |
| ---------------------------- | --------------------------------------------------------- |
| Video                        | `30.file`                                                 |
| Character image              | `9.image`                                                 |
| Start and length of the part | `trim.start_time`, `trim.duration`; `31.duration_seconds` |
| Quality (768p or 480p)       | `31.resolution` (`768` or `480`)                          |
| Extra direction              | `801.prompt`, through `swapPrompt`                        |
| Seed (blank draws one)       | `801.seed`                                                |
| Anchor (made by the page)    | `anchor_image.image`                                      |

Output: node `809` saves `openjutsu/result_*.mp4` (H.264, source audio). The
app takes the file whose name contains `result`.

## Metering

One job, and it is the paid one. The app proxy prices it from
`H3CharacterSwapPrepareVideo` (node 31): `duration_seconds` times the rate for
its `resolution`, 8 credits a second at 480p and 16 at 768p. `price.ts` prices
the same values the graph sends; a test ties the two. See `BENCHMARK.md`.

## Expected failures

- A clip whose first frame has no person (a fade from black, a title card)
  fails at `H3CharacterSwapSelectSubject` ("SAM found no subject") before any
  generation.
- With several people, the largest one is swapped.
- Hard cuts break the swap at the cut; one continuous shot is expected.
- A silent source gives a silent result.

## Licence

The node pack is GPL-3.0 (one Apache-2.0 file). H3 and the swap LoRA are under
the MiniMax H3 Community License, whose standard grant excludes the US, EU, UK
and South Korea. **This needs a decision before anything public.**
