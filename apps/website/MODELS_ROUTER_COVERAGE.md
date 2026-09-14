# Models / Router coverage — 2026-09-10

## September 10 schema refresh and publication policy

Frontend snapshot: `0d965bab7b9`.

Backend source: `9064b7d8748b2e5833be9a102f3ca36185137d86`,
`services/comfy-api/docs/router-schemas`. The full documents are retained in the
packed snapshot; the generated contracts keep native whole-request validation.

| Population at that snapshot        | Count |
| ---------------------------------- | ----: |
| Router schema documents            |   207 |
| Authored input contracts           |   206 |
| Preserved content/use-case records |   288 |
| Published content/use-case pages   |   155 |
| Distinct published Router models   |   113 |
| Published Incomplete pages         |     0 |

Eight inputs are newly authored: BytePlus Seed 2.0 Lite/Mini/Pro, both Gemini
Omni Interactions models, Ideogram V3, and LTX 2.5 Fast/Pro. Both Gemini Omni
models and Ideogram V3 now have executable forms in the content intersection.
The other newly described models remain schema-supported without inventing
content joins. A missing authored input now withholds the card, detail page and
legacy URLs. MiniMax H3 is the only remaining case: its content record
`minimax--hailuo-03--generate-videos` remains intact for future re-enablement.

The 207 IDs and identity-evidence backend files are unchanged from the previous
pin (`411500bd8c93a97328cf1a927b40ad5b24c60026`): checked the serving catalog,
middleware and all 15 paths cited by the identity audit. The 142 reviewed alias
mappings are preserved, with the new verified source pin; 141 have input schemas.

Composed object schemas expose ordinary controls while retaining their original
`allOf` constraints. Gemini/Seed use a Prompt textarea mapped to native `input`.
Ideogram V3 uses its native rendering-speed enum/default and aspect-ratio picker;
resolution is withheld because the provider forbids combining it with aspect
ratio ([provider reference](https://developer.ideogram.ai/api-reference/generate-images/generate-v3)).
LTX Pro's resolution picker is restricted to its model-specific matrix, not the
shared Fast/Pro union. Optional seed remains omitted; output count stays fixed.

## September 10 use-case input and media corrections

Eric's feedback is addressed by selecting a creator form per content/use-case
ID, without changing the native Router ID or weakening its request schema.
Seedance first/last frames, reference images and ordinary image-to-video now
have distinct controls and names. Related cards do not repeat the same Router
model. Grok, Luma, Wan 3, Gemini video and BFL video modes preserve their native
media paths; Beeble's video page explicitly requests video output.

Two incorrect category placements are withheld, not deleted from Rob's data:
`kling--v3--animate-images` points to a text-only request, and
`wan--reference-video--animate-images` requires a reference video. Their
supported Generate videos / Edit videos pages remain. This changes 157 to 155
published use-case pages while retaining 113 Router identities and all 288
source records.

Worked examples now restore only validated values for the selected form,
including source-image roles and valid duration/resolution/aspect-ratio values.
Veo first/last-frame examples download the actual source images on request
composition, validate MIME/size, and encode those bytes for its Base64 API.
URL-native inputs retain URL uploads. Every exposed resolution/aspect-ratio
control is a dropdown; optional seeds are not manufactured from invalid -1
examples. Video and audio inputs have inline media previews.

The Seedance 2.0 / FLUX.3 hero assets are videos, now rendered as videos.
Hero/card sizing follows Mar's current compact layout. Browser checks verify
decoded hero frames, Grok/Veo example images, Veo API composition, source media
controls, and desktop/mobile overflow without sending a generation request.

Content still needed: all three Seedance 1.0 Lite Animate images records have
empty `examples` and no output samples. No substitute model's media was added.
Kling Video Extend intentionally requests a prior generation's `video_id`:
its native API is not a generic source-video upload endpoint.

The Gemini Interactions typed media/input and video task selection follow the
[provider API reference](https://ai.google.dev/api/interactions-api?hl=en).
The committed Router schema remains the validation floor, not an invented
provider schema.

Schema presence and offline validation do not prove deployed model availability
or successful paid generation. No paid requests or purchases were made for this
refresh. See `MODELS_LOCAL_PREVIEW.md` for focused verification and credit recovery.

## Historical September 9 report

Everything below records the earlier model-only catalog and its measurements,
not the current use-case catalog or publication policy above.

Local implementation on disposable preview #17263, not a deployment or paid
generation report. No push, commit, merge, deployment or paid sweep this turn.

### September 9 catalog: verified intersection

Ben's explicit decision: **intersection, not union**. The earlier 453-record
union is removed. Rob's 268 entries corresponded to the partner-client
model/task list we supplied, not the native Router execution inventory.
Different ID spellings and task variants explain much, but not all, of the gap.

| Audit disposition                           | Original rows | Visible treatment                                  |
| ------------------------------------------- | ------------: | -------------------------------------------------- |
| Verified single-target identity             |           142 | Join to 114 distinct native Router IDs             |
| Verified but multiple/conditional targets   |             6 | Preserve evidence; do not pick an arbitrary target |
| Ambiguous version/operation                 |             4 | Exclude until identity is resolved                 |
| No supported native target in pinned source |           116 | Exclude; preserve source content                   |
| Total original records audited              |           268 | No source rows deleted                             |

Of the 142 single-target joins, 22 already used the native ID and **120 ID
spellings are repaired**. The corresponding old URLs redirect to the canonical
native page. Task variants collapse into one native card with merged verified
use cases/modalities, explicitly chosen primary artwork and no guessed preset.

| Current population                                           | Count |
| ------------------------------------------------------------ | ----: |
| Native Router identities in backend snapshot                 |   207 |
| Authored input contracts retained and generically supported  |   198 |
| Canonical Models cards/pages with verified content joins     |   114 |
| Canonical Models with authored input schemas                 |   110 |
| Canonical Models marked Incomplete                           |     4 |
| Verified legacy redirects                                    |   120 |
| Original task rows excluded from Models                      |   126 |
| Native Router-only rows without a single-target content join |    93 |

The 93 Router-only IDs stay in the source/schema data; they do not add extra
cards under the agreed intersection policy. A canonical model may appear in
multiple use-case sections, but remains one identity and one detail page.

Incomplete now means a verified native model with a missing authored input:
`gemini-interactions/gemini-omni-1.1-flash`,
`gemini-interactions/gemini-omni-flash-preview`, `ideogram/ideogram-v3`,
and `minimax/minimax-h3`. These have no invented input form, enabled Run or
copyable API request, regardless of sign-in. There are nine missing input
schemas in the full snapshot, but only these four are in the content intersection.

## Evidence and packed artifacts

Backend snapshot commit: `411500bd8c93a97328cf1a927b40ad5b24c60026`, including
Matt's cloud #8722. Source presence is not proof of deployment, authorization
or successful paid generation.

Three requested Sol/High agents audited 81 image/text, 98 video and 89
audio/3D/other-media records. Root cross-checked source endpoint/body selectors,
model versions and task semantics; similar names or a shared proxy endpoint
were not accepted as identity proof. No paid probes were made.

- `src/data/workshop-router-identity-audit.json`: all 268 dispositions, source
  evidence, target IDs and conditional-task notes, one record per line.
- `src/content/workshop-router-aliases.json`: 142 verified single-target joins,
  144 lines as a JSON array. Also carries explicit primary-artwork choices.
- `src/data/workshop-router-openapi.snapshot.json`: all 207 complete documents.
- `src/content/workshop-router-contracts.json`: 198 authored input contracts.
- `src/content/workshop-router-index.json`: all 207 lightweight native identities.

Generated data is packed, formatter-excluded and marked generated. From
`apps/website`, run:

```sh
pnpm generate:workshop-router-contracts
pnpm generate:workshop-router-aliases
```

The alias generator rejects missing/duplicate audit records, stale source
commits, unknown targets and conflicting primary artwork. Two regenerations
produce byte-identical aliases. Source evidence retains backend file/selector
references; temporary investigative reports live under
`/tmp/workshop-id-repair.JaIFEg/`, which is not a runtime input.

Six verified but non-single-target rows remain excluded:
`kling/omni-pro-edit-video`, `kling/omni-pro-first-last-frame`,
`kling/omni-pro-image-to-video`, `kling/omni-pro-text-to-video`,
`kling/omni-pro-video-to-video`, and `ltx/text-to-video-v2`.
The audit explains why a single replacement would lose a version/operation
choice. Meshy `latest` selectors likewise are not silently reinterpreted as
Meshy 7; uncertain Kling operations remain ambiguous.

## Rob's content and remaining editorial work

All **268 original records, 261 thumbnails (219 image, 42 video), 106 presets
and 113 output samples** remain packed in the source. The 142 joined source rows
contain 142 thumbnails, 86 presets and 91 samples before consolidation/quarantine;
these are source counts, not rendered-card counts.

An identity join does not validate normalized partner-client request parameters.
Current native pages use native schemas exclusively. Rob's presets remain in
source but are not applied as native requests. Joined output samples are labeled
as samples; viewing one preserves edited form and Native JSON drafts. Up to six
samples are shown per canonical model. Verify native preset values/input media
separately before restoring prefilling. Legacy task prices are not transferred
across repaired IDs.

`heygen/starfish-tts → heygen/starfish` is verified, but its supplied media and
example text actually describe Video Translate. Those media/examples are
quarantined from display; the correct Starfish title/summary and original source
remain. Rob needs to replace that content.

The importer supports optional `displayName` and Rob's `_displayName`.
His September 9 names are retained: MiniMax H3 and Nano Banana Pro appear on
canonical native pages. MiniMax H3 Video Regeneration remains named in source
but excluded without a verified Router identity. The older September 8 ZIP
still has the previous names.

## Runtime and verification

The generic runtime supports all 198 authored inputs, independently of page
eligibility. Native controls, Advanced fields, whole-body JSON for composed
schemas, validation, sign-in persistence and request transport
share the authoritative contract. No per-model enablement list remains.
The creator form now uses curated widget definitions: show known shared or
model-specific inputs, plus minimal required fallbacks. Optional unknown inputs
retain declared defaults or provider omission; top-level operational settings
are excluded. Nested filtering remains open. Native JSON mode is legacy-only.
See `MODELS_INPUT_SCHEMA.md` for the current rules and remaining limitations.
Some authored schemas are shared validation floors, not exhaustive per-task
provider rules; acceptance by a schema does not prove a paid call will succeed.

Output handling covers image/video/audio, multiple assets, inline/binary media,
text and downloadable 3D/unknown/raw responses. No new interactive 3D renderer
or general upload service is claimed. See `MODELS_LOCAL_PREVIEW.md` for detailed
runtime boundaries and local build commands.

- Full suite: **3,302 passing tests / 258 files**, including all 198 native forms,
  180 authored input examples and 161 JSON output examples.
- Typecheck: zero errors/warnings, five existing hints. Website Knip passes.
- Enabled intersection build: **1,846 pages**, 1,430 markdown twins.
- Updated widget sweep: all 114 current pages match the allowlist; typed default
  selections and SSR/hydration agree, with no page errors or paid requests.
- Browser sweep: 114 canonical pages hydrated, 120 verified aliases redirected,
  and 219 excluded URLs returned 404. No paid requests; external traffic blocked.
- Desktop/mobile search and Incomplete gates pass; output-only sample viewing
  preserves form and Native JSON drafts in Playwright. Screenshots were inspected
  with remote media blocked: layout/behavior proof, not a CDN playback test.

The inherited `/workshop/` tree still uses the original catalog; absence checks
above are specifically for `/models/`, not every file/route in the site.
Release-exclusion/route collision and shared-bundle issues remain inherited
launch blockers for this disposable preview. This is not production sign-off.

## Historical audit — before schema-native expansion

The following observations and per-task table preserve the old-client mapping
investigation. Statements about six adapters, 262 remaining models, or pending
per-provider implementation describe that earlier state, not the current one.
They remain useful only when reconciling legacy content aliases with native IDs.

## Findings that determine the remaining work

- Website catalog: **268 partner-client task entries**. These IDs must not be assumed to be Router invocation IDs.
- Backend source snapshot: **207 resolvable catalog identities**, with **198 authored input schemas** and **168 authored output schemas**. This is the source-level catalog without deployment embargo filtering, NOT the authenticated live catalog.
- Only **22/268 website IDs resolve unchanged** in that source snapshot. A matching ID still does not establish that the normalized form body matches its native request.
- Captured partner-client dispatches: **260/268** yielded a request we could inspect offline. Route comparison found **58 single-target**, **103 multi-target**, and **99 no-exact-route-match** cases. Eight capture/decoding failures remain inconclusive, not proof of unsupported models.
- The 99 unmatched paths may require a renamed route, an operation-specific ID, or backend Router support. Do not silently substitute a different model or fall back to /proxy.
- **Six native BFL adapters are implemented**; the other 262 stay unverified for execution. All 268 forms have projection/field-preservation tests. These are different guarantees.

## Implemented in this pass

- Preserve full property schemas through the new design into validation, including nested JSON constraints, typed enum values, explicit defaults and Unicode code-point length.
- Visible localized field errors do not require a paid submit. Submission opens Advanced when its fields have errors. Closing the disclosure preserves values.
- Advanced defaults no longer depend on where media inputs appear. Seed/toggles and overflow settings are placed in the foldout; required fields are not hidden by generation. Explicit editorial lists still override generation.
- Packed display overlay now carries **491 Advanced assignments across 191 models**. All non-Advanced content is byte-equivalent after JSON parsing to the previous overlay: 268 entries, 261 thumbnails, 106 presets and 113 output samples. These counts match HEAD and the original drop; the previously reported 94 was stale.
- Imported authored native input schemas for FLUX 2 Pro/Max, Kontext Pro/Max, FLUX 1.1 Pro/Ultra; corrected bounds, required prompt, media field names/cardinality, output formats and missing Advanced controls.
- Browser flow deliberately excludes webhook_url/webhook_secret. FLUX 2 Pro excludes safety_tolerance because the shared schema describes it as Max-only. These exclusions are explicit, not silently discarded on submit.
- API tab uses the same validated native request builder as Run. Unverified mappings and invalid inputs do not get a copyable pretend request. Python/TypeScript/cURL round-trip tests execute or parse the emitted code with network stubbed.
- Literal idempotency keys survive re-copy/retry and language switches; changed request bodies get new keys. No embedded login token or API key.

## Still required before claiming all models work

1. Establish each task-to-Router binding against the deployed authenticated catalog; compare operation and provider model selection, not display-name similarity. Current read-only unauthenticated catalog/schema requests return 401. No browser credentials were extracted.
2. Generate/validate native forms for the remaining models and implement typed canonical-to-native mappings where retaining the canonical form is necessary. Current normalized parameters are not a native contract for those 262 entries.
3. Complete media upload/URL handling and per-media extras, including Vidu multiframe metadata and Luma inline media alternatives. An output sample must never be treated as an input upload.
4. Obtain input-media assets for Rob's presets (the original drop contains no input-media URLs), then wire those prefills; reconcile example values against the final native schemas. Sample thumbnails and successful rendering are not generation evidence.
5. Implement provider-specific terminal response parsing for image/video/audio/3D, with request ID, cancellation semantics, idempotent retry and credit refresh coverage.
6. Test real signed-in runs with an explicitly bounded spend. No paid run was made by this audit.
7. Preserve the separate launch blockers: public-preview Cloud CORS, /models release exclusion/route collision and shared-bundle leakage. This disposable branch is not ready for main.

## Provenance and reproduction

The complete 207-document source export is now packed in
`src/data/workshop-router-openapi.snapshot.json` (209 lines). Refresh via
`pnpm generate:workshop-router-snapshot <documents.json> <backend-commit>`.
It retains referenced components, schema-authoring flags and output media
types, but is not imported into the browser or treated as a deployed allowlist.
All 207 input documents compile; 198 authored inputs produce runtime controls,
including five composed requests rendered as validated JSON editors. This is
renderer/validation coverage, not 198 integrated or successfully executed models.

- Website catalog: src/content/workshop-models.json, generated from partner-client sourceRef 0abe0d8859ab5739155b48d3a6eefd3f57890068.
- Backend: [Comfy-Org/cloud @ 411500bd8c93a97328cf1a927b40ad5b24c60026](https://github.com/Comfy-Org/cloud/tree/411500bd8c93a97328cf1a927b40ad5b24c60026).
- Matt's [schema tranche #8722](https://github.com/Comfy-Org/cloud/pull/8722) merged on 2026-09-09 at 21:07:19 UTC as `143715523294894d69057c5d8b150e594708d18d`. That commit is already an ancestor of this snapshot; the input spec, schema renderer and Router catalog have no changes between those two commits. Its 198/207 input coverage is included, not an additional tranche. Its nine remaining input gaps are the same ones requested from Matt. Merge status does not establish backend deployment or live catalog availability.
- Source census called the exported middleware.RouterModelList and ResolveRouterModel in an isolated Go program, using httptest and no server/network/auth credentials; every authored document was rendered by routerschema.Source.BuildDocument.
- Partner dispatches used platform/utils/partnerApiSnippet.ts capture helpers against synthetic examples; all external fetches were blocked. A path match is only a candidate. No captured body was blindly enabled as a v2 request.
- Local investigation artifacts: /tmp/models-router-contracts.qfmPJo/{audit.go,audit.json,partner-capture.json,route-comparison.json,bfl-documents.json}. The per-model conclusions below survive deletion of that scratch directory.
- Native input snapshot is packed in src/content/workshop-router-contracts.json, with the backend source commit on each record. Refresh with pnpm generate:workshop-router-contracts <documents.json> <backend-commit>, where documents.json is [{id,document}] from the authored per-model documents. Referenced schemas are rejected until their dependencies are deliberately bundled.
- [Router quickstart](https://docs.comfy.org/development/comfy-router/quickstart), [capabilities and limits](https://docs.comfy.org/development/comfy-router/limitations), [FLUX 2 Pro native fields](https://docs.comfy.org/development/comfy-router/models/black-forest-labs/flux-2-pro/code).

## Remaining Router schema gaps after #8722

These lists come from the packed snapshot's input/output authoring flags,
not the 268-entry website catalog. An unauthored permissive placeholder is
not sufficient to construct or verify a paid request. Ask for complete
per-model OpenAPI documents, including referenced components and output
content types. Deployment availability still needs a separate check.

Nine input schemas remain unauthored:

```text
byteplus/seed-2-0-lite-260228
byteplus/seed-2-0-mini-260215
byteplus/seed-2-0-pro-260328
gemini-interactions/gemini-omni-1.1-flash
gemini-interactions/gemini-omni-flash-preview
ideogram/ideogram-v3
ltx/ltx-2-5-fast
ltx/ltx-2-5-pro
minimax/minimax-h3
```

Thirty-nine output schemas remain unauthored:

```text
bria/image-edit-increase-resolution
bria/structured-instruction
bria/video-edit-green-screen
bria/video-edit-remove-background
bria/video-edit-replace-background
byteplus/seed-2-0-lite-260228
byteplus/seed-2-0-mini-260215
byteplus/seed-2-0-pro-260328
fal/h3-max
fal/h3-max-turbo
fal/patina
freepik/ai-image-upscaler-precision-v2
freepik/ai-skin-enhancer-creative
freepik/ai-skin-enhancer-faithful
freepik/ai-skin-enhancer-flexible
heygen/starfish
ideogram/ideogram-v3
ideogram/p-image-ideogram
kling/videos-avatar-image2video
kling/videos-lip-sync
kling/videos-video-extend
meshy/animations
meshy/remesh
meshy/rigging
moonvalley/image-to-video
moonvalley/text-to-image
moonvalley/text-to-video
moonvalley/video-to-video
moonvalley/video-to-video-resize
tencent/hunyuan-3d-part
tencent/hunyuan-3d-smart-topology
tencent/hunyuan-3d-texture-edit
tencent/hunyuan-3d-uv
vertexai/imagen-3.0-fast-generate-001
vertexai/imagen-3.0-generate-001
vertexai/imagen-3.0-generate-002
wavespeed/flashvsr
wavespeed/seedvr2
wavespeed/ultimate-image-upscaler
```

## Per-model execution audit

“Same ID” means source resolver success, not deployed availability. Route candidates compare the old client's captured proxy operation against Router targets. “Capture inconclusive” includes the old client's browser DNS dependency, Pika Scenes validation failure, and one request-body decoding failure.

| Website task ID                             | Same ID resolves | Captured operation / mapping work                                                              | Native execution in this branch  |
| ------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| beeble/switchx-image-edit                   | no               | /proxy/beeble/v1/switchx/generations; 1 Router route candidate(s)                              | mapping pending                  |
| beeble/switchx-video-edit                   | no               | /proxy/beeble/v1/switchx/generations; 1 Router route candidate(s)                              | mapping pending                  |
| bfl/flux-2-max                              | yes              | /proxy/bfl/flux-2-max/generate; 1 Router route candidate(s)                                    | implemented; live run unverified |
| bfl/flux-2-pro                              | yes              | /proxy/bfl/flux-2-pro/generate; 1 Router route candidate(s)                                    | implemented; live run unverified |
| bfl/flux-3-image-to-video                   | no               | /proxy/bfl/v1/flux-3-video; 1 Router route candidate(s)                                        | mapping pending                  |
| bfl/flux-3-text-to-video                    | no               | /proxy/bfl/v1/flux-3-video; 1 Router route candidate(s)                                        | mapping pending                  |
| bfl/flux-3-video-continuation               | no               | /proxy/bfl/v1/flux-3-video; 1 Router route candidate(s)                                        | mapping pending                  |
| bfl/flux-erase                              | no               | /proxy/bfl/v1/flux-tools/erase-v1; 1 Router route candidate(s)                                 | mapping pending                  |
| bfl/flux-kontext-max                        | yes              | /proxy/bfl/flux-kontext-max/generate; 1 Router route candidate(s)                              | implemented; live run unverified |
| bfl/flux-kontext-pro                        | yes              | /proxy/bfl/flux-kontext-pro/generate; 1 Router route candidate(s)                              | implemented; live run unverified |
| bfl/flux-pro-1.1                            | yes              | /proxy/bfl/flux-pro-1.1/generate; 1 Router route candidate(s)                                  | implemented; live run unverified |
| bfl/flux-pro-1.1-ultra                      | yes              | /proxy/bfl/flux-pro-1.1-ultra/generate; 1 Router route candidate(s)                            | implemented; live run unverified |
| bfl/flux-pro-expand                         | no               | /proxy/bfl/flux-pro-1.0-expand/generate; 1 Router route candidate(s)                           | mapping pending                  |
| bfl/flux-pro-fill                           | no               | /proxy/bfl/flux-pro-1.0-fill/generate; 1 Router route candidate(s)                             | mapping pending                  |
| bfl/flux-video-upscale                      | no               | Capture inconclusive                                                                           | mapping pending                  |
| bfl/flux-virtual-try-on                     | no               | /proxy/bfl/v1/flux-tools/vto-v1; 1 Router route candidate(s)                                   | mapping pending                  |
| bria/eraser                                 | no               | /proxy/bria/v2/image/edit/erase; 1 Router route candidate(s)                                   | mapping pending                  |
| bria/expand-image                           | no               | /proxy/bria/v2/image/edit/expand; 1 Router route candidate(s)                                  | mapping pending                  |
| bria/fibo-image-edit                        | no               | /proxy/bria/v2/image/edit; 1 Router route candidate(s)                                         | mapping pending                  |
| bria/generative-fill                        | no               | /proxy/bria/v2/image/edit/gen_fill; 1 Router route candidate(s)                                | mapping pending                  |
| bria/green-screen-video                     | no               | /proxy/bria/v2/video/edit/green_screen; 1 Router route candidate(s)                            | mapping pending                  |
| bria/increase-resolution                    | no               | /proxy/bria/v2/image/edit/increase_resolution; 1 Router route candidate(s)                     | mapping pending                  |
| bria/remove-image-background                | no               | /proxy/bria/v2/image/edit/remove_background; 1 Router route candidate(s)                       | mapping pending                  |
| bria/remove-video-background                | no               | /proxy/bria/v2/video/edit/remove_background; 1 Router route candidate(s)                       | mapping pending                  |
| bria/replace-video-background               | no               | /proxy/bria/v2/video/edit/replace_background; 1 Router route candidate(s)                      | mapping pending                  |
| byteplus-mediakit/video-enhance             | no               | /proxy/byteplusmediakit/api/v1/tools/enhance-video; 0 Router route candidate(s)                | mapping pending                  |
| byteplus/seed-audio-1.0                     | yes              | /proxy/byteplus/api/v3/tts/create; 2 Router route candidate(s)                                 | mapping pending                  |
| byteplus/seed-audio-1.0-multilingual        | yes              | /proxy/byteplus/api/v3/tts/create; 2 Router route candidate(s)                                 | mapping pending                  |
| byteplus/seedance-1-0-lite-first-last-frame | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-1-0-lite-image-reference  | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-1-0-lite-image-to-video   | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-1-0-lite-text-to-video    | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-5-first-last-frame      | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-5-reference             | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-5-text-to-video         | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-fast-first-last-frame   | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-fast-reference          | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-fast-text-to-video      | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedance-2-mini-text-to-video      | no               | /proxy/byteplus/api/v3/contents/generations/tasks; 9 Router route candidate(s)                 | mapping pending                  |
| byteplus/seedream-3                         | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| byteplus/seedream-4                         | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| byteplus/seedream-4-5                       | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| byteplus/seedream-5-lite                    | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| byteplus/seedream-5-pro                     | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| byteplus/seedream-5-pro-layer-separation    | no               | /proxy/byteplus/api/v3/images/generations; 6 Router route candidate(s)                         | mapping pending                  |
| elevenlabs/audio-isolation                  | no               | /proxy/elevenlabs/v1/audio-isolation; 0 Router route candidate(s)                              | mapping pending                  |
| elevenlabs/sound-effects                    | no               | /proxy/elevenlabs/v1/sound-generation; 1 Router route candidate(s)                             | mapping pending                  |
| elevenlabs/speech-to-speech                 | no               | /proxy/elevenlabs/v1/speech-to-speech/CwhRBWXzGAHq8TQ4Fs17; 0 Router route candidate(s)        | mapping pending                  |
| elevenlabs/text-to-dialogue                 | no               | /proxy/elevenlabs/v1/text-to-dialogue; 1 Router route candidate(s)                             | mapping pending                  |
| elevenlabs/text-to-speech                   | no               | /proxy/elevenlabs/v1/text-to-speech/CwhRBWXzGAHq8TQ4Fs17; 0 Router route candidate(s)          | mapping pending                  |
| fishaudio/text-to-speech                    | no               | /proxy/fishaudio/v1/tts; 0 Router route candidate(s)                                           | mapping pending                  |
| freepik/magnific-relight                    | no               | /proxy/freepik/v1/ai/image-relight; 0 Router route candidate(s)                                | mapping pending                  |
| freepik/magnific-skin-enhancer              | no               | /proxy/freepik/v1/ai/skin-enhancer/creative; 1 Router route candidate(s)                       | mapping pending                  |
| freepik/magnific-style-transfer             | no               | /proxy/freepik/v1/ai/image-style-transfer; 0 Router route candidate(s)                         | mapping pending                  |
| freepik/magnific-upscaler-creative          | no               | /proxy/freepik/v1/ai/image-upscaler; 0 Router route candidate(s)                               | mapping pending                  |
| freepik/magnific-upscaler-precise-v2        | no               | /proxy/freepik/v1/ai/image-upscaler-precision-v2; 1 Router route candidate(s)                  | mapping pending                  |
| gemini/omni-1.1-flash                       | no               | /proxy/gemini-interactions; 2 Router route candidate(s)                                        | mapping pending                  |
| gemini/omni-flash-preview                   | no               | /proxy/gemini-interactions; 2 Router route candidate(s)                                        | mapping pending                  |
| heygen/avatar-video                         | no               | /proxy/heygen/v3/videos; 0 Router route candidate(s)                                           | mapping pending                  |
| heygen/starfish-tts                         | no               | /proxy/heygen/v3/voices/speech; 1 Router route candidate(s)                                    | mapping pending                  |
| heygen/talking-photo                        | no               | /proxy/heygen/v3/videos; 0 Router route candidate(s)                                           | mapping pending                  |
| heygen/video-translate                      | no               | /proxy/heygen/v3/video-translations; 0 Router route candidate(s)                               | mapping pending                  |
| hitpaw/general-image-enhance-generative     | no               | /proxy/hitpaw/api/photo-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/general-image-enhance-portrait       | no               | /proxy/hitpaw/api/photo-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-general-restore-1x     | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-general-restore-2x     | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-general-restore-4x     | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-generative-1x          | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-portrait-restore-1x    | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-portrait-restore-2x    | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| hitpaw/video-enhance-ultra-hd-2x            | no               | /proxy/hitpaw/api/video-enhancer; 0 Router route candidate(s)                                  | mapping pending                  |
| ideogram/p-image                            | no               | /proxy/ideogram/text-to-image/p-image-ideogram; 1 Router route candidate(s)                    | mapping pending                  |
| ideogram/v1                                 | no               | /proxy/ideogram/generate; 0 Router route candidate(s)                                          | mapping pending                  |
| ideogram/v1-turbo                           | no               | /proxy/ideogram/generate; 0 Router route candidate(s)                                          | mapping pending                  |
| ideogram/v2                                 | no               | /proxy/ideogram/generate; 0 Router route candidate(s)                                          | mapping pending                  |
| ideogram/v2-turbo                           | no               | /proxy/ideogram/generate; 0 Router route candidate(s)                                          | mapping pending                  |
| ideogram/v3                                 | no               | /proxy/ideogram/ideogram-v3/generate; 1 Router route candidate(s)                              | mapping pending                  |
| ideogram/v3-edit                            | no               | /proxy/ideogram/ideogram-v3/edit; 0 Router route candidate(s)                                  | mapping pending                  |
| ideogram/v4                                 | no               | /proxy/ideogram/ideogram-v4/generate; 1 Router route candidate(s)                              | mapping pending                  |
| kling/avatar                                | no               | /proxy/kling/v1/videos/avatar/image2video; 1 Router route candidate(s)                         | mapping pending                  |
| kling/camera-control-image-to-video         | no               | /proxy/kling/v1/videos/image2video; 2 Router route candidate(s)                                | mapping pending                  |
| kling/camera-control-text-to-video          | no               | /proxy/kling/v1/videos/text2video; 7 Router route candidate(s)                                 | mapping pending                  |
| kling/dual-character-effect                 | no               | /proxy/kling/v1/videos/effects; 0 Router route candidate(s)                                    | mapping pending                  |
| kling/first-last-frame                      | no               | /proxy/kling/v1/videos/image2video; 2 Router route candidate(s)                                | mapping pending                  |
| kling/image-generation                      | no               | /proxy/kling/v1/images/generations; 0 Router route candidate(s)                                | mapping pending                  |
| kling/image-to-video                        | no               | /proxy/kling/v1/videos/image2video; 2 Router route candidate(s)                                | mapping pending                  |
| kling/image-to-video-with-audio             | no               | /proxy/kling/v1/videos/image2video; 2 Router route candidate(s)                                | mapping pending                  |
| kling/kling-3.0-turbo-image-to-video        | no               | /proxy/kling/image-to-video/kling-3.0-turbo; 0 Router route candidate(s)                       | mapping pending                  |
| kling/kling-3.0-turbo-text-to-video         | no               | /proxy/kling/text-to-video/kling-3.0-turbo; 1 Router route candidate(s)                        | mapping pending                  |
| kling/lip-sync-audio-to-video               | no               | /proxy/kling/v1/videos/lip-sync; 1 Router route candidate(s)                                   | mapping pending                  |
| kling/lip-sync-text-to-video                | no               | /proxy/kling/v1/videos/lip-sync; 1 Router route candidate(s)                                   | mapping pending                  |
| kling/motion-control                        | no               | /proxy/kling/v1/videos/motion-control; 0 Router route candidate(s)                             | mapping pending                  |
| kling/omni-pro-edit-video                   | no               | /proxy/kling/v1/videos/omni-video; 2 Router route candidate(s)                                 | mapping pending                  |
| kling/omni-pro-first-last-frame             | no               | /proxy/kling/v1/videos/omni-video; 2 Router route candidate(s)                                 | mapping pending                  |
| kling/omni-pro-image                        | no               | /proxy/kling/v1/images/omni-image; 1 Router route candidate(s)                                 | mapping pending                  |
| kling/omni-pro-image-to-video               | no               | /proxy/kling/v1/videos/omni-video; 2 Router route candidate(s)                                 | mapping pending                  |
| kling/omni-pro-text-to-video                | no               | /proxy/kling/v1/videos/omni-video; 2 Router route candidate(s)                                 | mapping pending                  |
| kling/omni-pro-video-to-video               | no               | /proxy/kling/v1/videos/omni-video; 2 Router route candidate(s)                                 | mapping pending                  |
| kling/single-image-effect                   | no               | /proxy/kling/v1/videos/effects; 0 Router route candidate(s)                                    | mapping pending                  |
| kling/start-end-frame                       | no               | /proxy/kling/v1/videos/image2video; 2 Router route candidate(s)                                | mapping pending                  |
| kling/text-to-video                         | no               | /proxy/kling/v1/videos/text2video; 7 Router route candidate(s)                                 | mapping pending                  |
| kling/text-to-video-with-audio              | no               | /proxy/kling/v1/videos/text2video; 7 Router route candidate(s)                                 | mapping pending                  |
| kling/v3                                    | no               | /proxy/kling/v1/videos/text2video; 7 Router route candidate(s)                                 | mapping pending                  |
| kling/video-extend                          | no               | /proxy/kling/v1/videos/video-extend; 1 Router route candidate(s)                               | mapping pending                  |
| kling/virtual-try-on                        | no               | /proxy/kling/v1/images/kolors-virtual-try-on; 0 Router route candidate(s)                      | mapping pending                  |
| krea/krea-2-large                           | yes              | /proxy/krea/generate/image/krea/krea-2/large; 1 Router route candidate(s)                      | mapping pending                  |
| krea/krea-2-medium                          | yes              | /proxy/krea/generate/image/krea/krea-2/medium; 2 Router route candidate(s)                     | mapping pending                  |
| krea/krea-2-medium-turbo                    | yes              | /proxy/krea/generate/image/krea/krea-2/medium-turbo; 1 Router route candidate(s)               | mapping pending                  |
| ltx/audio-to-video-v2                       | no               | Capture inconclusive                                                                           | mapping pending                  |
| ltx/image-to-video                          | no               | Capture inconclusive                                                                           | mapping pending                  |
| ltx/image-to-video-v2                       | no               | Capture inconclusive                                                                           | mapping pending                  |
| ltx/text-to-video                           | no               | /proxy/ltx/v1/text-to-video; 0 Router route candidate(s)                                       | mapping pending                  |
| ltx/text-to-video-v2                        | no               | /proxy/ltx/v2/text-to-video; 2 Router route candidate(s)                                       | mapping pending                  |
| luma/photon-1-image-generation              | no               | /proxy/luma/generations/image; 2 Router route candidate(s)                                     | mapping pending                  |
| luma/photon-1-image-modify                  | no               | /proxy/luma/generations/image; 2 Router route candidate(s)                                     | mapping pending                  |
| luma/photon-flash-1-image-generation        | no               | /proxy/luma/generations/image; 2 Router route candidate(s)                                     | mapping pending                  |
| luma/photon-flash-1-image-modify            | no               | /proxy/luma/generations/image; 2 Router route candidate(s)                                     | mapping pending                  |
| luma/ray-2-image-to-video                   | no               | /proxy/luma/generations; 2 Router route candidate(s)                                           | mapping pending                  |
| luma/ray-2-text-to-video                    | no               | /proxy/luma/generations; 2 Router route candidate(s)                                           | mapping pending                  |
| luma/ray-flash-2-image-to-video             | no               | /proxy/luma/generations; 2 Router route candidate(s)                                           | mapping pending                  |
| luma/ray-flash-2-text-to-video              | no               | /proxy/luma/generations; 2 Router route candidate(s)                                           | mapping pending                  |
| luma_2/ray-3.2-video-edit                   | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/ray-3.2-video-generation             | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/ray-3.2-video-reframe                | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/uni-1-image-edit                     | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/uni-1-image-generation               | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/uni-1-max-image-edit                 | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| luma_2/uni-1-max-image-generation           | no               | /proxy/luma_2/generations; 2 Router route candidate(s)                                         | mapping pending                  |
| meshy/animate                               | no               | /proxy/meshy/openapi/v1/animations; 1 Router route candidate(s)                                | mapping pending                  |
| meshy/image-to-model                        | no               | /proxy/meshy/openapi/v1/image-to-3d; 0 Router route candidate(s)                               | mapping pending                  |
| meshy/multi-image-to-model                  | no               | /proxy/meshy/openapi/v1/multi-image-to-3d; 0 Router route candidate(s)                         | mapping pending                  |
| meshy/refine                                | no               | /proxy/meshy/openapi/v2/text-to-3d; 3 Router route candidate(s)                                | mapping pending                  |
| meshy/remesh                                | yes              | /proxy/meshy/openapi/v1/remesh; 1 Router route candidate(s)                                    | mapping pending                  |
| meshy/rig                                   | no               | /proxy/meshy/openapi/v1/rigging; 1 Router route candidate(s)                                   | mapping pending                  |
| meshy/text-to-model                         | no               | /proxy/meshy/openapi/v2/text-to-3d; 3 Router route candidate(s)                                | mapping pending                  |
| meshy/texture                               | no               | /proxy/meshy/openapi/v1/retexture; 0 Router route candidate(s)                                 | mapping pending                  |
| meshy/texture-multiview                     | no               | /proxy/meshy/openapi/v1/retexture; 0 Router route candidate(s)                                 | mapping pending                  |
| minimax/hailuo-02                           | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/hailuo-03                           | no               | /proxy/minimax/v2/video_generation; 1 Router route candidate(s)                                | mapping pending                  |
| minimax/hailuo-03-regeneration              | no               | /proxy/minimax/v2/video_regeneration; 0 Router route candidate(s)                              | mapping pending                  |
| minimax/i2v-01                              | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/i2v-01-director                     | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/i2v-01-live                         | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/s2v-01                              | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/t2v-01                              | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| minimax/t2v-01-director                     | no               | /proxy/minimax/video_generation; 0 Router route candidate(s)                                   | mapping pending                  |
| openai/dall-e-2                             | no               | /proxy/openai/images/generations; 5 Router route candidate(s)                                  | mapping pending                  |
| openai/dall-e-3                             | no               | /proxy/openai/images/generations; 5 Router route candidate(s)                                  | mapping pending                  |
| openai/gpt-image-1                          | yes              | /proxy/openai/images/generations; 5 Router route candidate(s)                                  | mapping pending                  |
| openai/gpt-image-1.5                        | yes              | /proxy/openai/images/generations; 5 Router route candidate(s)                                  | mapping pending                  |
| openai/gpt-image-2                          | yes              | /proxy/openai/images/generations; 5 Router route candidate(s)                                  | mapping pending                  |
| openai/sora-2                               | no               | /proxy/openai/v1/videos; 0 Router route candidate(s)                                           | mapping pending                  |
| openai/sora-2-pro                           | no               | /proxy/openai/v1/videos; 0 Router route candidate(s)                                           | mapping pending                  |
| pika/additions                              | no               | /proxy/pika/generate/pikadditions; 0 Router route candidate(s)                                 | mapping pending                  |
| pika/image-to-video                         | no               | /proxy/pika/generate/2.2/i2v; 0 Router route candidate(s)                                      | mapping pending                  |
| pika/keyframes                              | no               | /proxy/pika/generate/2.2/pikaframes; 0 Router route candidate(s)                               | mapping pending                  |
| pika/pikaffects                             | no               | /proxy/pika/generate/pikaffects; 0 Router route candidate(s)                                   | mapping pending                  |
| pika/scenes                                 | no               | Capture inconclusive                                                                           | mapping pending                  |
| pika/swaps                                  | no               | /proxy/pika/generate/pikaswaps; 0 Router route candidate(s)                                    | mapping pending                  |
| pika/text-to-video                          | no               | Capture inconclusive                                                                           | mapping pending                  |
| pixverse/image-to-video                     | no               | /proxy/pixverse/image/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/text-to-video                      | no               | /proxy/pixverse/video/text/generate; 0 Router route candidate(s)                               | mapping pending                  |
| pixverse/transition-video                   | no               | /proxy/pixverse/image/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/v6-extend-video                    | no               | /proxy/pixverse/media/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/v6-first-last-frame                | no               | /proxy/pixverse/image/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/v6-fusion                          | no               | /proxy/pixverse/image/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/v6-image-to-video                  | no               | /proxy/pixverse/image/upload; 0 Router route candidate(s)                                      | mapping pending                  |
| pixverse/v6-text-to-video                   | no               | /proxy/pixverse/video/text/generate; 0 Router route candidate(s)                               | mapping pending                  |
| quiver/arrow-image-to-svg                   | no               | /proxy/quiver/v1/svgs/vectorizations; 0 Router route candidate(s)                              | mapping pending                  |
| quiver/arrow-text-to-svg                    | no               | /proxy/quiver/v1/svgs/generations; 0 Router route candidate(s)                                 | mapping pending                  |
| qwen/qwen-image-3.0-image-edit              | no               | /proxy/qwen/api/v1/services/aigc/multimodal-generation/generation; 2 Router route candidate(s) | mapping pending                  |
| qwen/qwen-image-3.0-pro-image-edit          | no               | /proxy/qwen/api/v1/services/aigc/multimodal-generation/generation; 2 Router route candidate(s) | mapping pending                  |
| qwen/qwen-image-3.0-pro-text-to-image       | no               | /proxy/qwen/api/v1/services/aigc/multimodal-generation/generation; 2 Router route candidate(s) | mapping pending                  |
| qwen/qwen-image-3.0-text-to-image           | no               | /proxy/qwen/api/v1/services/aigc/multimodal-generation/generation; 2 Router route candidate(s) | mapping pending                  |
| recraft/v3-text-to-image                    | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v3-text-to-vector                   | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4-pro-text-to-image                | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4-pro-text-to-vector               | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4-text-to-image                    | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4-text-to-vector                   | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-pro-text-to-image              | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-pro-text-to-vector             | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-text-to-image                  | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-text-to-vector                 | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-utility-pro-text-to-image      | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-utility-pro-text-to-vector     | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-utility-text-to-image          | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| recraft/v4.1-utility-text-to-vector         | no               | /proxy/recraft/image_generation; 16 Router route candidate(s)                                  | mapping pending                  |
| rodin/detail                                | no               | /proxy/rodin/api/v2/rodin; 0 Router route candidate(s)                                         | mapping pending                  |
| rodin/gen2                                  | no               | /proxy/rodin/api/v2/rodin; 0 Router route candidate(s)                                         | mapping pending                  |
| rodin/regular                               | no               | /proxy/rodin/api/v2/rodin; 0 Router route candidate(s)                                         | mapping pending                  |
| rodin/sketch                                | no               | /proxy/rodin/api/v2/rodin; 0 Router route candidate(s)                                         | mapping pending                  |
| rodin/smooth                                | no               | /proxy/rodin/api/v2/rodin; 0 Router route candidate(s)                                         | mapping pending                  |
| runway/aleph2-video-to-video                | no               | /proxy/runway/video_to_video; 1 Router route candidate(s)                                      | mapping pending                  |
| runway/gen3a-turbo-first-last-frame         | no               | /proxy/runway/image_to_video; 1 Router route candidate(s)                                      | mapping pending                  |
| runway/gen3a-turbo-image-to-video           | no               | /proxy/runway/image_to_video; 1 Router route candidate(s)                                      | mapping pending                  |
| runway/gen4-image                           | no               | /proxy/runway/text_to_image; 1 Router route candidate(s)                                       | mapping pending                  |
| runway/gen4-turbo-image-to-video            | no               | /proxy/runway/image_to_video; 1 Router route candidate(s)                                      | mapping pending                  |
| sonilo/text-to-music                        | no               | /proxy/sonilo/t2m/generate; 0 Router route candidate(s)                                        | mapping pending                  |
| sonilo/video-to-music                       | no               | /proxy/sonilo/v2m/generate; 0 Router route candidate(s)                                        | mapping pending                  |
| synclabs/lip-sync                           | no               | /proxy/synclabs/v2/generate; 0 Router route candidate(s)                                       | mapping pending                  |
| synclabs/talking-image                      | no               | /proxy/synclabs/v2/generate; 0 Router route candidate(s)                                       | mapping pending                  |
| tencent-hunyuan3d/3d-part                   | no               | /proxy/tencent/hunyuan/3d-part; 1 Router route candidate(s)                                    | mapping pending                  |
| tencent-hunyuan3d/3d-texture-edit           | no               | /proxy/tencent/hunyuan/3d-texture-edit; 1 Router route candidate(s)                            | mapping pending                  |
| tencent-hunyuan3d/image-to-model-3.0        | no               | Capture inconclusive                                                                           | mapping pending                  |
| tencent-hunyuan3d/image-to-model-3.1        | no               | Capture inconclusive                                                                           | mapping pending                  |
| tencent-hunyuan3d/model-to-3d-uv            | no               | /proxy/tencent/hunyuan/3d-uv; 1 Router route candidate(s)                                      | mapping pending                  |
| tencent-hunyuan3d/smart-topology            | no               | /proxy/tencent/hunyuan/3d-smart-topology; 1 Router route candidate(s)                          | mapping pending                  |
| tencent-hunyuan3d/text-to-model-3.0         | no               | /proxy/tencent/hunyuan/3d-pro; 0 Router route candidate(s)                                     | mapping pending                  |
| tencent-hunyuan3d/text-to-model-3.1         | no               | /proxy/tencent/hunyuan/3d-pro; 0 Router route candidate(s)                                     | mapping pending                  |
| topaz/bloom-2                               | no               | /proxy/topaz/image/v1/enhance-gen/async; 0 Router route candidate(s)                           | mapping pending                  |
| topaz/image-enhance                         | no               | /proxy/topaz/image/v1/enhance-gen/async; 0 Router route candidate(s)                           | mapping pending                  |
| topaz/video-enhance                         | no               | /proxy/topaz/video/; 0 Router route candidate(s)                                               | mapping pending                  |
| topaz/wonder-3.5                            | no               | /proxy/topaz/image/v1/enhance-gen/async; 0 Router route candidate(s)                           | mapping pending                  |
| tripo/conversion                            | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/image-to-model                        | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/multiview-to-model                    | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/retarget                              | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/rig                                   | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/text-to-model                         | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| tripo/texture                               | no               | /proxy/tripo/v2/openapi/task; 0 Router route candidate(s)                                      | mapping pending                  |
| vertexai/gemini-2.5-flash-image             | yes              | /proxy/vertexai/gemini/gemini-2.5-flash-image; 11 Router route candidate(s)                    | mapping pending                  |
| vertexai/gemini-3-pro-image                 | yes              | /proxy/vertexai/gemini/gemini-3-pro-image-preview; 11 Router route candidate(s)                | mapping pending                  |
| vertexai/gemini-nano-banana-2               | no               | /proxy/vertexai/gemini/gemini-3.1-flash-image-preview; 11 Router route candidate(s)            | mapping pending                  |
| vertexai/veo-3                              | no               | /proxy/veo/veo-3.1-generate-001/generate; 5 Router route candidate(s)                          | mapping pending                  |
| vertexai/veo-3-first-last-frame             | no               | /proxy/veo/veo-3.1-generate-001/generate; 5 Router route candidate(s)                          | mapping pending                  |
| vidu/extend-q2-pro                          | no               | /proxy/vidu/extend; 0 Router route candidate(s)                                                | mapping pending                  |
| vidu/image-to-video-q1                      | no               | /proxy/vidu/img2video; 0 Router route candidate(s)                                             | mapping pending                  |
| vidu/image-to-video-q2-pro                  | no               | /proxy/vidu/img2video; 0 Router route candidate(s)                                             | mapping pending                  |
| vidu/image-to-video-q3-pro                  | no               | /proxy/vidu/img2video; 0 Router route candidate(s)                                             | mapping pending                  |
| vidu/multiframe-q2-pro                      | no               | /proxy/vidu/multiframe; 0 Router route candidate(s)                                            | mapping pending                  |
| vidu/reference-video-q1                     | no               | /proxy/vidu/reference2video; 0 Router route candidate(s)                                       | mapping pending                  |
| vidu/reference-video-q2                     | no               | /proxy/vidu/reference2video; 0 Router route candidate(s)                                       | mapping pending                  |
| vidu/start-end-to-video-q1                  | no               | /proxy/vidu/start-end2video; 0 Router route candidate(s)                                       | mapping pending                  |
| vidu/start-end-to-video-q2-pro              | no               | /proxy/vidu/start-end2video; 0 Router route candidate(s)                                       | mapping pending                  |
| vidu/start-end-to-video-q3-pro              | no               | /proxy/vidu/start-end2video; 0 Router route candidate(s)                                       | mapping pending                  |
| vidu/text-to-video-q1                       | no               | /proxy/vidu/text2video; 0 Router route candidate(s)                                            | mapping pending                  |
| vidu/text-to-video-q2                       | no               | /proxy/vidu/text2video; 0 Router route candidate(s)                                            | mapping pending                  |
| vidu/text-to-video-q3-pro                   | no               | /proxy/vidu/text2video; 0 Router route candidate(s)                                            | mapping pending                  |
| wan/happyhorse-image-to-video               | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/happyhorse-reference-video              | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/happyhorse-text-to-video                | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/happyhorse-video-edit                   | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/image-to-image                          | no               | /proxy/wan/api/v1/services/aigc/image2image/image-synthesis; 1 Router route candidate(s)       | mapping pending                  |
| wan/image-to-video                          | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/image-to-video-2.7                      | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/image-to-video-3.0                      | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/image-to-video-3.0-prime                | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/reference-to-video-3.0                  | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/reference-to-video-3.0-prime            | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/reference-video                         | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/reference-video-2.7                     | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/text-to-image                           | no               | /proxy/wan/api/v1/services/aigc/text2image/image-synthesis; 1 Router route candidate(s)        | mapping pending                  |
| wan/text-to-video                           | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/text-to-video-2.7                       | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/video-continuation-2.7                  | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wan/video-edit-2.7                          | no               | /proxy/wan/api/v1/services/aigc/video-generation/video-synthesis; 18 Router route candidate(s) | mapping pending                  |
| wavespeed/flashvsr                          | yes              | /proxy/wavespeed/api/v3/wavespeed-ai/flashvsr; 1 Router route candidate(s)                     | mapping pending                  |
| wavespeed/seedvr2-image                     | no               | /proxy/wavespeed/api/v3/wavespeed-ai/seedvr2/image; 1 Router route candidate(s)                | mapping pending                  |
| wavespeed/ultimate-image-upscaler           | yes              | /proxy/wavespeed/api/v3/wavespeed-ai/ultimate-image-upscaler; 1 Router route candidate(s)      | mapping pending                  |
| xai/grok-imagine-image                      | yes              | /proxy/xai/v1/images/generations; 4 Router route candidate(s)                                  | mapping pending                  |
| xai/grok-imagine-image-edit                 | no               | /proxy/xai/v1/images/edits; 0 Router route candidate(s)                                        | mapping pending                  |
| xai/grok-imagine-video                      | yes              | /proxy/xai/v1/videos/generations; 3 Router route candidate(s)                                  | mapping pending                  |
| xai/grok-imagine-video-1.5                  | yes              | /proxy/xai/v1/videos/generations; 3 Router route candidate(s)                                  | mapping pending                  |
| xai/grok-imagine-video-1.5-reference        | no               | /proxy/xai/v1/videos/generations; 3 Router route candidate(s)                                  | mapping pending                  |
| xai/grok-imagine-video-edit                 | no               | /proxy/xai/v1/videos/edits; 0 Router route candidate(s)                                        | mapping pending                  |
| xai/grok-imagine-video-extend               | no               | /proxy/xai/v1/videos/extensions; 0 Router route candidate(s)                                   | mapping pending                  |
| xai/grok-imagine-video-reference            | no               | /proxy/xai/v1/videos/generations; 3 Router route candidate(s)                                  | mapping pending                  |
