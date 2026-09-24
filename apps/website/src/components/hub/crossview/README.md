# CrossView Warp demo

A prototype of `/hub/workflow/crossview_warp_h3/`: re-shoot a video from a new
camera angle with MiniMax H3, the CrossView-Warp LoRA
([Cseti](https://huggingface.co/Cseti/MiniMax-H3_Ref2VA-LoRA-CrossView-Warp_v1))
and the [CrossViewWarp node](https://github.com/cseti007/ComfyUI-CrossViewWarp).

Everything lives in this folder. It touches the rest of the site in six places:

| File                                                    | What                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/pages/hub/workflow/[name].astro`                   | one branch that renders `CrossViewPlayground` for this template                  |
| `src/config/workshop-launch.ts`                         | the card, second in _Create & edit videos_                                       |
| `src/data/hubTemplates.json`, `hubTemplateDetails.json` | its catalogue rows                                                               |
| `public/hub/crossview/`                                 | card thumbnail and the generate graph the Details tab draws (the worked example's videos are on media.comfy.org) |
| `scripts/crossview-dev-proxy.ts`                        | the local key-holding proxy, dev only                                            |
| `package.json`                                          | a `dev:crossview-proxy` script that runs it                                      |

Deleting those and this folder removes the demo.

## How it runs

Two jobs on a dedicated Comfy API deployment:

1. **Analyze** (`analyze.api.json`): the clip is resampled to 24 fps, cut to
   the most frames H3's 17k + 5 grid fits, and cropped and sized to the chosen
   aspect and output size (`CrossViewPrepareClip`), MoGe
   estimates metric depth, and `CrossViewGeometryExport` returns one `.cvgeo`
   file: the frames as JPEGs plus depth at preview scale (`cvgeo.ts` reads it).
2. **Aim**, in the browser: `warp-renderer.ts` redoes the node's warp in WebGL2
   and `camera.ts` its camera maths, so the preview answers a drag immediately.
   `camera.test.ts` checks the port against fixtures written by the node itself.
3. **Generate** (`generate.api.json`): same preparation and MoGe, then
   CrossView Warp with the camera from the page (pivot included), H3 with the
   CrossView and 8-step turbo LoRAs, and three videos back: the result with
   H3's sound, the same frames with the clip's original sound, and the warp
   guide.

The two helper nodes are on
[comfyrob/ComfyUI-CrossViewWarp](https://github.com/comfyrob/ComfyUI-CrossViewWarp/tree/comfyrob/demo-nodes)
(`crossview_demo_nodes.py`), which the deployment's build pins.

The node's own live preview cannot be used here: it caches the clip in the
server process and serves renders from a custom route, and a deployment is
stateless and exposes only the v2 job and asset endpoints.

## What a real backend replaces

`deployment.ts` talks to `PUBLIC_CROSSVIEW_PROXY` (default `http://127.0.0.1:4329`), a local proxy
(`scripts/crossview-dev-proxy.ts`) that adds the deployment's API key. There is
no production path: no auth, no quotas, no billing, no job ownership. Replace
the `PROXY` base and the proxy with a server route, and everything else stays.

## Known limits

- Changing the clip, aspect ratio or output size after an analysis discards
  the depth and asks for a new one: those settings change the frames
  themselves. Nothing is cached between analyses; a real backend could keep
  the geometry per clip and settings.
- Clips must be 5 to 15 seconds. Letterboxed clips warp their black bars as
  if they were scenery.

## Running it locally

```sh
# ~/.config/comfy-workshop/crossview.env
export CROSSVIEW_DEPLOYMENT_URL=https://dep-….run.comfy.app
# and COMFY_API_KEY in the same file or deployment.env

pnpm --filter @comfyorg/website dev:crossview-proxy
pnpm --filter @comfyorg/website dev
```
