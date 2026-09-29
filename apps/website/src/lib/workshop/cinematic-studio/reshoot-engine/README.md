# Re-shoot engine

What makes the Cinematic Studio's Re-shoot app (`?app=reshoot`) run for real:
re-shoot a video from a new camera angle with MiniMax H3, the CrossView-Warp
LoRA ([Cseti](https://huggingface.co/Cseti/MiniMax-H3_Ref2VA-LoRA-CrossView-Warp_v1))
and the [CrossViewWarp node](https://github.com/cseti007/ComfyUI-CrossViewWarp).
The files here came over from the `/hub/` CrossView demo (#18691); the only
change is that `warp-renderer.ts` can draw at the output size (below).

| File                          | What                                                                    |
| ----------------------------- | ----------------------------------------------------------------------- |
| `deployment.ts`               | binds the two graphs and talks to the deployment's v2 job/asset API     |
| `analyze.api.json`            | job 1: prepare the clip, MoGe depth, one `.cvgeo` file back             |
| `generate.api.json`           | job 2: prepare, MoGe, CrossView Warp, H3; three videos back             |
| `cvgeo.ts`                    | reads the `.cvgeo` file (frames as JPEGs, depth at preview scale)       |
| `camera.ts`, `camera.test.ts` | the node's camera maths, checked against fixtures the node wrote        |
| `warp-renderer.ts`            | the node's warp redone in WebGL2, so the preview answers a drag at once |

The page side is `composables/useReshootRun.ts` (state and jobs),
`../reshoot-path.ts` (the camera move: keys to keyframes, the camera at any
frame), `ReshootWarp.vue` (the live warp in the viewport) and
`ReshootTimeline.vue` (play, scrub and key under it); the rest is the design's
own components.

## How it runs

1. **Analyze depth** is a button, not automatic: it is a paid job. The clip is
   resampled to 24 fps, cut to the most frames H3's 17k + 5 grid fits, cropped
   and sized to the chosen aspect and output size (`CrossViewPrepareClip`),
   MoGe estimates metric depth and `CrossViewGeometryExport` returns the
   `.cvgeo`.
2. **Aim**, in the browser, over that depth. Magenta is what the source camera
   never saw. The preview's points come from the preview-sized depth but are
   drawn at the output size, each sized to meet its neighbours on the same
   surface (capped, so pixels smeared across an edge stay specks). It differs
   from the node's guide in detail, not in what is seen and what is missing;
   very close up the steepest surfaces can still show thin gaps.
   Keys work as in the node's own editor: aiming on a key edits it, between
   keys it tries a pose that Key writes, and the timeline flies the path.
3. **Generate** sends the aimed camera (pivot and keyframes included) and gets
   back the result with H3's sound, the same frames with the clip's original
   sound, and the warp guide: the take view's Sound and Show toggles.

The two helper nodes are on
[comfyrob/ComfyUI-CrossViewWarp](https://github.com/comfyrob/ComfyUI-CrossViewWarp/tree/comfyrob/demo-nodes)
(`crossview_demo_nodes.py`), which the deployment's build pins.

## What a real backend replaces

`deployment.ts` talks to `PUBLIC_CROSSVIEW_PROXY` (default
`http://127.0.0.1:4329`), a local proxy (`scripts/crossview-dev-proxy.ts`)
that adds the deployment's API key. There is no production path: no auth, no
quotas, no billing, no job ownership. Replace the `PROXY` base and the proxy
with a server route, and everything else stays.

## Known limits

- Changing the clip, aspect ratio or output size after an analysis marks the
  depth stale and asks for a new one: those settings change the frames
  themselves. Nothing is cached between page loads.
- Clips must be 5 to 15 seconds. Letterboxed clips warp their black bars as
  if they were scenery.
- One take renders at a time; aiming stays live while it does.

## Running it locally

```sh
# ~/.config/comfy-workshop/crossview.env
export CROSSVIEW_DEPLOYMENT_URL=https://dep-….run.comfy.app
# and COMFY_API_KEY in the same file or deployment.env

pnpm --filter @comfyorg/website dev:crossview-proxy
pnpm --filter @comfyorg/website dev
```
