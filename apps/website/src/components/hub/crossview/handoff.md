# CrossView Warp demo: handoff

A working prototype of **Re-shoot a video: aim your own camera**
(`/hub/workflow/crossview_warp_h3/`), built on the V2 catalogue branch. It runs
end to end against a dedicated Comfy API deployment, and is written to be
replaced: the frontend is self-contained, and the one backend piece, a local
proxy holding an API key, is a stand-in for a real server route.

`README.md` in this folder covers how the page works; this file covers what
changed, what it depends on, and what the real implementation has to supply.

## What a visitor does

1. **Upload a 5 to 15 second clip**, pick an aspect ratio and an output size
   (480p = 0.4 MP, 768p = 1.0 MP). The whole clip is used, as many frames as
   MiniMax H3's 17k + 5 grid fits at 24 fps.
2. **Analyze depth** (stage 1, about 20 to 40 s). The deployment prepares the
   clip, runs MoGe, and returns one `.cvgeo` file.
3. **Aim the camera** in the browser: drag the preview to orbit, scroll to move
   closer, or use the sliders; scrub and press Key to build a camera move. The
   preview is the node's own warp redrawn in WebGL2, so it updates per frame
   with no server round trip.
4. **Generate** (stage 2, about 1.5 to 5 min at 480p). Returns the new view with
   H3's generated sound, the same take with the clip's original sound, and the
   warp guide. Each take of the session can be revisited and downloaded.

## Changes in this repository

Everything new lives in `src/components/hub/crossview/`. The rest of the site
is touched in six places:

| File                                                    | Change                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/pages/hub/workflow/[name].astro`                   | one branch rendering `CrossViewPlayground` and the Details tab for `crossview_warp_h3`        |
| `src/config/workshop-launch.ts`                         | the card, second in _Create & edit videos_, marked `ownEndpoint`                              |
| `src/data/hubTemplates.json`, `hubTemplateDetails.json` | its catalogue rows: credited to HelloRob, description credits Cseti for the LoRA and node     |
| `public/hub/crossview/`                                 | card thumbnail (a frame of a real result) and the generate graph in editor format for Details |
| `scripts/crossview-dev-proxy.ts`                        | the local key-holding proxy, dev only                                                         |
| `package.json`                                          | a `dev:crossview-proxy` script that runs the proxy                                            |

Inside the folder:

| File                                      | Role                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `CrossViewPlayground.vue`                 | the page: clip settings, runs, results, takes                            |
| `CrossViewPreview.vue`                    | the live warp canvas, drag/scroll orbit, scrub, Key                      |
| `warp-renderer.ts`                        | WebGL2 port of the node's `_warp_frame` (25 splat passes, magenta holes) |
| `camera.ts`                               | port of the node's orbit, look-at, pivot estimate and keyframe paths     |
| `camera.test.ts` + `camera.fixtures.json` | holds the port to fixtures written by the node's own Python              |
| `cvgeo.ts`                                | reader for the stage 1 geometry file                                     |
| `deployment.ts`                           | the whole backend conversation: v2 assets and jobs, via the proxy        |
| `analyze.api.json`, `generate.api.json`   | the two API graphs, bound per run in `deployment.ts`                     |
| `copy.ts`                                 | the page's English copy, kept out of the Hub's translation tables        |

Nothing in `useWorkflowRun`, the Cloud session, auth or the shared run
components changed.

## Changes to the node pack

Fork: [comfyrob/ComfyUI-CrossViewWarp](https://github.com/comfyrob/ComfyUI-CrossViewWarp/tree/comfyrob/demo-nodes),
branch `comfyrob/demo-nodes`, on top of
[cseti007/ComfyUI-CrossViewWarp](https://github.com/cseti007/ComfyUI-CrossViewWarp) `3266a83`.
The author's two files are unchanged; the additions are one module,
`crossview_demo_nodes.py`, plus a smoke test.

- **CrossView Prepare Clip**: video in; resamples to 24 fps, keeps as many
  frames as fit H3's 17k + 5 grid, centre-crops to an aspect and resizes to a
  pixel budget. Outputs frames, width, height, length, and the clip's own
  audio trimmed to exactly those frames (silence if it has none). Both stages
  start with it, so the frames previewed are the frames generated from.
- **CrossView Geometry Export**: frames + MoGe geometry in, one `.cvgeo` file
  out (reported by the v2 API as a `file` output): JPEG frames plus float16
  metric depth at 384 px, the same data the node's own live preview caches.

Why they exist: the node's live preview keeps the clip in server memory and
answers drags from a custom route. A deployment is stateless and only exposes
the v2 job and asset endpoints, so the preview had to move to the browser, and
the browser needs the geometry as a file.

These could go upstream to cseti007 as a PR if the author wants them; nothing
in them is specific to this site.

## The deployment

A Comfy API deployment (Developer Platform) from a dedicated build:

- **Base**: ComfyUI `2255709aa0` (v0.37.0, has MiniMax H3 and MoGe in core)
- **Custom nodes**: the fork above, pinned by commit
- **Models**, all pinned to a Hugging Face revision:

| File                                                              | Source                                         |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors`               | Comfy-Org/MiniMax-H3                           |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors`                 | Comfy-Org/MiniMax-H3                           |
| `minimax_h3_video_vae_int8_convrot.safetensors`                   | Comfy-Org/MiniMax-H3                           |
| `minimax_h3_audio_vae_fp32.safetensors`                           | Comfy-Org/MiniMax-H3                           |
| `moge_2_vitl_normal_fp16.safetensors`                             | Comfy-Org/MoGe                                 |
| `MiniMax-H3_Ref2VA-LoRA-CrossView-Warp_v1_3500.safetensors`       | Cseti/MiniMax-H3_Ref2VA-LoRA-CrossView-Warp_v1 |
| `minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` | lightx2v/Minimax-h3-Turbo                      |

- **Compute**: one RTX PRO 6000 (96 GB), scale to zero. A cold start loads
  about 50 GB of weights; the first generation after one takes minutes.

With comfy-cli 1.20 a deployment is pinned to its release: a node change means
a new release and a new deployment with a new URL.

## What the real backend has to supply

`deployment.ts` sends everything to `PUBLIC_CROSSVIEW_PROXY` (default
`http://127.0.0.1:4329`). The proxy adds the deployment's API key and forwards
`/api/v2/*`. It runs on a developer's machine only; the key never reaches the
browser or this repository. A real implementation needs:

- **A server route** that holds the key and forwards the same four calls:
  upload an asset, submit a job, poll a job, fetch an output's content.
- **Auth and ownership**: today any caller of the proxy can run jobs; jobs and
  uploads should belong to the signed-in visitor.
- **Quotas and billing**: a generation holds a 96 GB GPU for minutes.
- **Retention**: takes live only as object URLs in the tab. Depth analyses are
  not cached, so changing aspect or size re-analyzes; a backend could keep the
  geometry per clip and settings.

The contract the frontend relies on:

- Assets are content-addressed: re-uploading the same bytes returns the
  earlier asset under its earlier name, and that returned `file_path` is what
  `LoadVideo` must be given.
- A deployment still coming up answers `deployment_not_ready`; the page
  retries every 10 s and shows "Starting a server".
- Outputs are found by file name: `.cvgeo` (stage 1); `result`,
  `original-audio`, `warp` (stage 2).

## Known limits

- The worked example's clip and result are on the media CDN
  (`media.comfy.org/website/workshop/crossview/`); only the card thumbnail is
  in this repository.
- The CrossView LoRA follows angles well and distance loosely (the author says
  as much); looking up past -20° is thinly trained.
- Letterboxed clips warp their black bars as scenery; masked sky becomes
  magenta the model has to invent.
- 768p is H3's native size but above what the CrossView LoRA was trained at
  (512²). Higher resolutions would need the author's upscale pass as a
  separate job.
- English only; the copy is local to this folder.

## Verification

- `camera.test.ts`: the camera port matches the node's Python on orbit poses,
  every keyframe motion and the pivot estimate.
- The WebGL warp was compared with the node's own preview renderer on a real
  analysis: 0, 0 and 1 differing pixels out of 83,712 across three poses.
- End to end through the page: upload, analyze, aim, keyframes, generate,
  takes and downloads.

## Running it

```sh
# ~/.config/comfy-workshop/crossview.env (never committed)
export CROSSVIEW_DEPLOYMENT_URL=https://<deployment>.run.comfy.app
export COMFY_API_KEY=<key>

pnpm --filter @comfyorg/website dev:crossview-proxy
pnpm --filter @comfyorg/website dev
# open /hub/workflow/crossview_warp_h3/
```
