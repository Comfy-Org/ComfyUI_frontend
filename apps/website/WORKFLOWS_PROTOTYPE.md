# Workshop Phase 2: workflow prototype

Review entry: `/models/workflows/`. The launch catalog has **30 outcome cards**,
six in each category, following the [launch specification](https://app.notion.com/p/3de6d73d365081d0b5bafdb9d9ffbf12):

1. Create & edit videos
2. Animate characters
3. Create product photos & ads
4. Upscale & restore
5. Edit & clean up photos

This is an editorial category order, not a measured popularity ranking. The
adoption ordering is stored in `src/data/workflow-popularity.json` without internal
usage counts. Template starts are not successful generations. The four existing
shelves retain their adoption ordering.

The hero starts with **Turn an image into a video** and offers five selectable
category highlights. Media uses individual hero focal points; card titles have
a fixed two-line height with ellipsis overflow. Discovery reuses Models search
and filtering, without See all.

## September 21 video category

- Turn an image into a video — LTX-2.3; MiniMax H3 is linked as an alternative in
  the same detail page, not a duplicate card. LTX is the provisional prototype
  default; runtime quality, latency, and cost still need launch validation.
- Create a video from references — MiniMax H3, with two image inputs. The prompt
  was adapted to the actual two references, removing the unbound audio request.
- Connect two images with motion — LTX-2.3; start image 31 and end image 39 are
  traced through preprocessing to guide frame indices 0 and -1.
- Change a video’s background — Seedance 2.5; editable background-change prompt
  replaces the template’s clay-style example instruction. Its existing preview
  remains a general editing example, not proof of this new default’s output.
- Remove an object from a video — simulated Comfy API deployment using LTX-2.3,
  the object-removal LoRA, and the catalog’s declared custom-node dependencies.
- Expand a video’s frame — LTX-2.3; video, reference frame, target aspect ratio, and scene prompt.

Five additional API graphs were exported using Comfy CLI 1.20.0
`run --print-prompt --where cloud` against the same pinned template revision.
All five pass the CLI graph validator against its Cloud node definitions; the
outpainting graph has two unused decoder warnings, pruned by the backend.
No new live generation was submitted. Structural validation does not prove
runtime compatibility, availability, output quality, latency, or cost.

The object-removal demo replaces the restoration demo, restoring the sixth real
upscaling card. `/models/workflows/restore-video-api/` remains a compatibility
alias; the catalog links `/models/workflows/remove-object-from-video/`.
The demo simulates sign-in, server startup, model loading, generation, cancellation,
and Copy to Comfy API. It uploads nothing and creates no deployment.
Its input is the official piano clip. `public/workflows/object-removal-sample.mp4`
is a format conversion of the official animated template preview at the pinned
revision: original on top, object removed below. The demo always returns that
labeled sample, regardless of the local file or prompt.

The execution and validation notes below describe the original 24 templates
unless otherwise specified above.

## Run locally

```sh
WORKSHOP_IN_BUILD=1 PUBLIC_WORKSHOP_ENABLED=1 PUBLIC_WORKSHOP_AUTH_FLAG=1 \
PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website dev \
  --host 127.0.0.1 --port 4327
```

Use the repository's supported Node version. The local UI works signed out.
Cloud currently allows the production `comfy.org` browser origin; the localhost
workflow-submit preflight was rejected. An authenticated browser execution test
therefore needs an allowed deployment origin and a funded Cloud workspace.
Use the staging/test family on Vercel previews, consistent with the existing
website deployment checks. Do not bypass or disable browser CORS protections.

## Execution contract

- Uses the website's existing session client; refreshes and checks the workspace
  before every authenticated operation. No API key is shipped or stored here.
- Uses the established Cloud canvas endpoints: `/api/upload/image`,
  `/api/prompt`, `/api/jobs/:id`, `/api/jobs/:id/assets`, asset content, and job
  cancellation. Responses validate with generated `@comfyorg/ingest-types`.
- Example inputs are fetched from the pinned public repository, then uploaded
  into the signed-in account, exactly like a user's selected input files.
- UI shows actual queued/running/terminal states, not simulated progress.
- No automatic submission retry. The canvas endpoint has no documented
  idempotent replay contract. Ambiguous submission failures require checking
  Cloud; polling errors reconnect to the known job without resubmitting.
- Cancellation calls the backend; leaving/signing out stops observation and
  discards late results but does not claim the remote job was cancelled.
- Downloads use authenticated asset retrieval. Examples remain labeled examples.

The v2 API was investigated first. Its asset endpoint rejected the available
CLI OAuth session with 401, while the canvas endpoints accepted it. Do not infer
that website workspace JWT support in v2 is verified from its documented
`extra_data.auth_token_comfy_org` field: credential forwarding and endpoint
authentication are separate. A v2 migration needs a verified browser auth contract.

## Source and validation

Official templates are pinned to
[`90c71fb`](https://github.com/Comfy-Org/workflow_templates/tree/90c71fb78b3726392d010ff62a8e79e92d7296ad).
API graphs in `src/data/workflows/` were exported with Comfy CLI 1.18.0 against
Cloud node definitions on September 16, 2026 (`run --print-prompt`, no execution).
Only explicit curated node/input bindings are exposed; there is no general
runtime conversion of arbitrary user graphs.

The API artifacts omit editor-only `ImageCompare` nodes (image upscaler 46,
Bria 5, HitPaw 4, Topaz 8); their save outputs remain. Background removal replaces
the result preview with `SaveImage` and omits the mask preview, so the result can
be retrieved as an output asset. Bria's canvas Painter and Flux inpainting's
alpha-mask connection are adapted to a separate `LoadImageMask` input. Both pages
require a same-size black-and-white mask upload (white edits, black preserves),
with validation before any upload or submission. They have no default mask.
The reference-sheet export omits the prompt switch’s unenhanced input. Its
`on_false` input is restored from the original prompt default and exposed as the
editable scene instruction; prompt enhancement remains disabled as in the source.

All 24 artifacts pass structural validation against live Cloud definitions.
The validator reports union-type edge warnings in virtual try-on, character
replacement, image upscaling, archival restoration, and reference-sheet animation. The archival template
also retains an unused audio-decode node that the backend prunes.
Structural validation is not proof that model availability or every run succeeds.

Live smoke test: both material-replacement example uploads returned 200. The
submission was rejected with 429 / `PAYMENT_REQUIRED` (“Insufficient credits to
queue workflows”). No successful generation, output retrieval, or cancellation
has been verified against a live job. No credits were purchased.

The Cloud CTA opens the published original template, not a snapshot of edited
website inputs. Copying those edits and uploaded assets across surfaces remains
a backend/product follow-up. Developer links open existing docs and the platform;
they do not claim a deployment was created.

## Before production

Verify authenticated browser execution on the intended deployment origin with a
funded workspace; success/error/cancellation/output behavior for the curated set;
partner-node billing; input sizing limits; and the exact Cloud-copy contract.
Add localization and persistent recovery across navigation. These routes are
noindex and use the existing Workshop build gate. This is a review prototype.

Suggested implementation review split after prototype feedback: catalog and
content, execution/auth/billing integration, and graph/Cloud handoff.

### Read-only ComfyUI graph preview

- The Comfy API object-removal demo leads the video shelf. Hero selections exclude deployment demos, so the video hero continues to feature image-to-video.
- Both regular workflows and the deployment demo use the same lazy-loaded canvas viewer. Both use the same Playground, Workflow, and API tab layout.
- `public/workflows/graphs/` contains the original editor JSON for all 30 launch templates, pinned to workflow_templates revision `90c71fb78b3726392d010ff62a8e79e92d7296ad`. These preserve the layout and subgraph definitions that API execution JSON omits.
- The viewer uses Comfy Org's MIT-licensed `@comfyorg/litegraph` 0.17.2 package. This standalone package is deprecated; current renderer development lives inside ComfyUI_frontend. Keep this integration isolated for the prototype and review a maintained renderer strategy before production.
- Connection colors in `src/data/workflow-node-colors.json` are copied from ComfyUI_frontend’s `src/assets/palettes/dark.json` node-slot palette.
- Display-only nodes preserve positions, sizes, connections, groups, and saved values. A graph-level selector opens nested generation graphs. Custom node code, media preview widgets, and editable controls are not installed or executed. Full saved values remain available in Node details.
- Pan, zoom, fit, keyboard navigation, resize handling, and renderer cleanup are supported. Viewing a graph does not authenticate or submit a job.

### API code examples

All 30 launch pages now share a Models-style API panel with Python, TypeScript,
cURL, syntax highlighting, Copy snippet, and a downloadable API graph. Examples
use actual curated node IDs and current prompt/settings. The 29 regular templates
target the shared Cloud v2 jobs endpoint; the deployment demo requires the user's
own deployed base URL. SDK examples upload inputs, submit a job, wait, and save
outputs. The Bash example submits once and reads status, with polling guidance.
See [the per-workflow API assessment](WORKFLOW_API_COVERAGE.md) for inputs,
primary sources, validation evidence, and unverified live-runtime requirements.
