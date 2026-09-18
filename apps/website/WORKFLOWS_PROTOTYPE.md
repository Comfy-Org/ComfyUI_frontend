# Workshop Phase 2: workflow prototype

Review entry: `/models/workflows/`. Twenty-four outcome-led workflow pages extend the
existing Models catalog. Primary action: run with editable inputs on the page.
Secondary action: open the original template in the Cloud canvas. The prototype
has no marketplace, clone fees, creator earnings, ratings, or publishing tools.

Categories, in popularity order: Animate characters, Create product photos & ads,
Upscale & restore, Edit & clean up photos. Shelf order is a snapshot of distinct
Cloud users triggering `execution_start` for any of the shelf's included templates
from August 17 to September 16, 2026 (America/Los_Angeles), with template-only and
production-host filters and configured test-account exclusions. Users are
deduplicated within each shelf; per-template counts are not summed. Re-query when
the included templates change. This orders the current curated set, not the full
template catalog. The catalog shares the Models hero and horizontal
card rows, with matching banner dimensions, card proportions, and typography.
The shortlist combines popular editing/animation templates with concrete product
photography use cases. Cards within each shelf are also ordered by full-period
distinct template starters, using the same window and filters. These are start
attempts, not successful runs. Shelf sizes are 6 character workflows, 6 product
workflows, 6 upscaling/restoration workflows, and 6 photo-editing workflows.
The filter reuses the Models component: multi-select, search, clear, keyboard
dismissal, and a mobile bottom sheet. The category
labels and customer-facing descriptions are editorial proposals for review.

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
