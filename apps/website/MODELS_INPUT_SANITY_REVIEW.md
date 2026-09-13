# Models input sanity review and rubric

September 10, 2026. Requested review of the current local combined preview,
including its uncommitted content/use-case and Resolution/single-output work.
This is a read-only review, not authorization to change code or run generations.

## Product standard

A person should recognize the controls, understand what to supply, and produce
a valid request for the advertised model/use case without knowing Router's JSON.
Prefer a small, obvious form over complete exposure of the provider schema.

## Review checks

| Area                 | What to check                                                                                                     | Suspicious examples                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task fit             | The specific model/use-case page offers the inputs its task needs.                                                | Edit mode without a source image; create mode requiring an unrelated video; a mode never reaching the request.                                         |
| Vocabulary           | Shared concepts have shared, brief labels and consistent units.                                                   | Provider field names, underscores, redundant Size and Resolution, unexplained IDs, verbose API prose.                                                  |
| Basic/Advanced       | The basic path is short; optional specialist settings are secondary or omitted.                                   | Seed/guidance cluttering the main path; necessary input buried in Advanced; callback/webhook knobs exposed.                                            |
| Widget choice        | Dropdown for known choices; precise slider only with both bounds; text box/area and media picker match the value. | Text entry for a known resolution list; float rounded to integer; multiline prose forced into a small box; raw JSON/Base64 demanded from a person.     |
| Defaults             | Defaults are valid, useful, selected and displayed consistently; prompt starts with a suitable example/starter.   | Blank `—` despite a default; default outside an enum; false/zero lost; invalid restored value; an image-edit prompt on a create page.                  |
| Simple output policy | No output-count control; supported count parameters send one.                                                     | Native four-output default leaking through nested parameters; image-series control bypassing single-output intent.                                     |
| Media                | Requiredness, accepted files, URL/Base64 encoding, ordering and cardinality match the native request.             | Fake filename sent as URL; incorrect nested image object; multiple uploads collapsing to one; missing first frame; unusable task/model reference.      |
| Request fidelity     | Visible controls preserve exact native names, types, units and nesting through the composer.                      | Slider changes absent from the body; wrong width/height separator; strings replacing numbers; hidden defaults unexpectedly overwriting selections.     |
| Validation/feedback  | Invalid values fail before Run with useful inline, field-associated feedback.                                     | Error only at request-body level for a known field; silently dropped selection; required field impossible to satisfy; Advanced error remaining hidden. |
| Interactions         | Conditional and mutually exclusive inputs behave coherently; edits persist.                                       | Two competing size controls; default conflicts with uploaded media; reset or example selection overwrites unrelated user input.                        |
| UI behavior          | Inspect the actual current component path, not just metadata.                                                     | SSR-selected option disagrees with hydrated state; no accessible label; disabled control with no explanation.                                          |
| Capability honesty   | A labeled task and enabled Run path have a supported input route.                                                 | Shared provider schema treated as proof a specific version supports every choice; missing schema presented as runnable.                                |

## Evidence and false-positive rules

- Review the current worktree, not the older PR preview or previous conversation.
  Start with `routerWorkshopModels`, `getRouterWorkshopModelDetail`,
  `schemaForModel`, `defaultValues`, `validateForm` and
  `prepareWorkshopRouterInput`. Inspect actual per-use-case slugs.
- Check both the curated contract and the pinned native OpenAPI snapshot.
  Native schema validation proves shape, not undocumented provider semantics.
  For disputed semantics, cite current primary provider/Router documentation
  for the exact model/version, or mark the claim unverified.
- Preserve the intentional allowlist: omitted optional provider features are
  not automatically bugs. Required media, voice IDs and prior-task IDs cannot
  be fabricated just to make the initial form validate.
- A valid native default, `0`, `false`, an optional unset input, deliberate
  Advanced placement, or packed long JSON lines is not inherently a finding.
- Different `x`/`*`/case-sensitive resolution values may be correct on the wire.
  Judge creator-facing clarity separately from serialization compatibility.
- No count widget is not proof of one output: inspect the actual composed body.
  Conversely, retained legacy content values are not sent merely because they
  exist in Rob's source file.
- Current known gaps: per-use-case widget/default/mode overrides are not yet
  wired; distinct media is still missing for some cases; four Router IDs lack
  authored input schemas and are intentionally marked Incomplete. Report their
  concrete effects, but do not inflate each affected row into a separate bug.
- Dev-key release gating and hosted-upload CORS are already tracked separately.
  Do not reclassify either as a newly discovered per-model widget bug.
- Group findings by root cause. Treat counts/length thresholds as investigation
  hints, not proof of poor UX. Do not invent improvements to fill a quota.
- Report uncertainty and missed coverage. Do not claim every model works because
  defaults or mock requests validate. No paid provider acceptance is being tested.

## Severity and confidence

- **P0:** demonstrated secret exposure or comparable critical risk in scope.
- **P1:** advertised task cannot work, silently wrong request, unintended extra
  paid outputs, or required input cannot be supplied through the UI.
- **P2:** substantial confusion or avoidable friction; a useful task remains
  available, but the control/default/help/feedback materially misleads.
- **P3:** optional polish, not a blocker.

Tag every item **demonstrated**, **probable**, or **needs confirmation**. Severity
and confidence are separate. An unverified suspicion is not a confirmed blocker.

## Required finding format

1. Short title; severity; confidence; new finding or known gap.
2. Router ID(s), content slug/use case, creator input name and native JSON path.
3. Expected behavior versus observed behavior; consequence to the user.
4. Minimal reproduction or exact prepared-body evidence; file/line references
   and relevant primary documentation. Do not paste an entire packed record.
5. Affected scope, smallest suggested correction, and remaining uncertainty.

Each reviewer also reports assigned IDs/pages, inspected coverage, known-good
checks, tests/probes actually run, and anything not inspected.

## Execution boundaries

Use Sol High reviewers, partitioned by provider families. Review files and run
small offline diagnostic probes/focused tests only. No implementation edits,
commits, pushes, PR comments, real uploads, paid generations, full test suite,
browser/render tests, or secret inspection. The parent consolidates findings,
independently checks the strongest ones and records results here.

## Results — September 10, 2026

The controls are substantially more consistent, but a clean-looking form is not
yet sufficient proof that it performs the task named on its page. The largest
demonstrated gap is the known missing per-use-case input/default binding.
Separately, provider-specific limits are sometimes narrower than our native
snapshot, and several media/structured-input paths remain unnecessarily difficult.

Three independent **gpt-5.6-sol / high** reviewers partitioned the visible catalog.
The parent reviewed their reports and independently reproduced representative
request mismatches and a shared-component feedback defect. This is a review of
the local tree, not a certification of the deployed PR or live provider execution.

### Coverage and frozen snapshot

| Reviewer                | Visible pages | Distinct Router IDs | Scope                                                                                                           |
| ----------------------- | ------------: | ------------------: | --------------------------------------------------------------------------------------------------------------- |
| Image / 3D              |            69 |                  57 | BFL, BRIA, Freepik, Ideogram, Krea, Luma Uni, Meshy, Qwen, Recraft, Tencent, Vertex AI images, OpenAI GPT Image |
| Video                   |            48 |                  29 | BytePlus, Kling, Luma Photon/Ray, Runway, Veo                                                                   |
| Mixed media             |            41 |                  28 | Beeble, ElevenLabs, Gemini Interactions, HeyGen, MiniMax, Wan, WaveSpeed, xAI                                   |
| **Total, deduplicated** |       **158** |             **114** | All currently visible model/use-case records                                                                    |

Eight pages over four IDs correctly have no input schema and remain Incomplete:
`gemini-interactions/gemini-omni-1.1-flash`,
`gemini-interactions/gemini-omni-flash-preview`, `ideogram/ideogram-v3`, and
`minimax/minimax-h3`. Their absent forms are not new findings.

Worktree: `/Users/ben/comfy/ws-16556-content-preview`.
Branch: `ben/workshop-16556-content-preview`.
HEAD: `2a14a792dd720c72287d1ceba863bc1524842cd6`, **plus the existing dirty changes**.
The content/use-case split and Resolution/single-output changes were included.
These three input snapshots remained byte-identical throughout the review:

```text
src/content/workshop-display.json
b04b35c8d803c8ff8ba20fe2d8dfc819b0863994974d0c2405af146edb7e6b31
src/content/workshop-router-contracts.json
97c68b3792f262a65f5b5d791c7bb2a5f52b7b5044e603dcbc9eed5b55b525b5
src/data/workshop-router-openapi.snapshot.json
729d6d802298a013f1a954b49a3dc59c28eb70777431389e1fe6a620656957f8
```

Enumeration means every current form/default was inspected; it does **not** mean
every combination, upload, browser state or provider response was exercised.
The detailed reports distinguish visible-page review from additional dormant
contract scans. Overlapping probes are not counted as extra coverage.

### F01 — Page task is not applied to its inputs or request

**P1; demonstrated; known architectural gap with concrete consequences.**

[workshop-router-content.ts](src/config/workshop-router-content.ts), lines 33–60,
selects one contract/form by Router ID. The content record's reviewed alias
`nativeDefaults` and `condition` are not applied. Distinct slugs, use-case rows,
artwork and starters therefore do not yet imply distinct executable forms.

Representative failures, grouped under this one cause:

| Page/family                                               | What the user expects                                          | What preparation actually permits or emits                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `luma_2--uni-1-image-edit--edit-images` and Uni Max edit  | Source image and fixed edit operation                          | No source-image input, no `type:image_edit`; prompt-only body validates.                                            |
| `bfl--flux-3-image-to-video--animate-images`              | First frame and `mode:i2v`                                     | Defaults to `mode:t2v` with no keyframes. Video continuation similarly does not fix `v2v`.                          |
| Luma Photon modify / Ray image-to-video                   | `modify_image_ref` / keyframes                                 | Defining image controls are absent; text-generation body passes.                                                    |
| Seedance Lite first/last-frame and reference pages        | Two ordered frames or references                               | Only the first-frame input exists. Seedance 2 Fast/2.5 case-specific media are optional.                            |
| Seedream edit and layer separation                        | Source image; layer separation enabled on that page            | Source is optional and `layer_decomposition` starts false.                                                          |
| Kling camera-control / audio / text-lip-sync / v3 animate | Camera controls, audio on, text/voice, or first image as named | Missing camera/image controls; audio page defaults `sound:off`; text lip sync hard-codes `audio2video`.             |
| Veo animate and first/last-frame pages                    | Required task-specific frames                                  | Both pages accept text-only generation.                                                                             |
| `beeble--switchx-video-edit--edit-videos`                 | Video output                                                   | Supplying a video still defaults `generation_type:image`.                                                           |
| Wan 3.0/Prime image/reference pages                       | First frame or ordered references                              | No media inputs; only prompt reaches `input`.                                                                       |
| `wan--video-continuation-2.7--animate-images`             | Source video as `first_clip`                                   | Requires an image and composes `first_frame` instead.                                                               |
| xAI reference-video pages                                 | Nonempty `reference_images`, no first-frame `image`            | Only optional first-frame image exists; composer never creates references.                                          |
| OpenAI GPT Image edit pages                               | Image input for an edit                                        | No image input exists; only the generations-shaped JSON form is available.                                          |
| Qwen / Gemini image-edit pages                            | Required source images                                         | Source images are optional and text-only bodies validate.                                                           |
| Recraft v3/v4/Pro vector aliases                          | Audited vector operation                                       | Audited selector/default is not applied. Check the current native vector mapping before implementing this override. |

The parent independently ran the actual Luma Uni and BFL content slugs through
`schemaForModel` → `defaultValues` → `validateForm` →
`prepareWorkshopRouterInput`: both default forms validated with no errors and
prepared the wrong task shape. No Router call was needed to demonstrate the
frontend mismatch.

**Suggested correction:** use each content record's own inputs, requiredness and
fixed defaults to construct the form **and** prepared request, while retaining
the canonical Router schema as the final validator. Test the content slug, not
only its Router ID. Add callback options where the native media structure really
differs. Do not blanket-hide valid optional inputs or fabricate required media.
Until a particular facet is supported, describe its limitation honestly.

See the detailed provider reports for exact slugs, paths and prepared-body
examples; these are not dozens of independent architecture bugs.

### F02 — Text-to-dialogue is limited to one voice/text row

**P1; demonstrated; new capability mismatch.**

`elevenlabs--text-to-dialogue--audio` → `elevenlabs/eleven_v3` promises
multi-speaker dialogue, but [workshop-creator-models.json](src/data/workshop-creator-models.json),
lines 2–4, hard-codes a one-element `inputs` array. The UI exposes one Text and
one Voice. The parent reproduced a body with exactly one utterance.
Its starter describes ocean-wave ambience, which TTS would read aloud; it is
not an appropriate dialogue starter.

Add ordered repeatable text/voice rows within the native constraints, or label
the currently supported task as single-voice speech. The schema's maximum of
ten **distinct voice IDs** must not be mistaken for a ten-utterance limit.

### F03 — Multi-reference content has only a single-reference input

**P2; demonstrated; new mismatch distinct from wrong task selection.**

`wan--reference-video-2.7--animate-images` → `wan/wan2.7-r2v` has a two-image
starter that refers to `image1` and `image2`, and describes mixed image/video
references. The creator form accepts one Reference image; the callback emits
one `reference_image` entry. A useful single-reference task remains available,
but its active example cannot be reproduced.

Use ordered repeatable supported references, or revise the starter/description
to the intentionally supported subset. Missing optional capabilities alone are
not the finding; advertising and seeding inaccessible inputs is.

### F04 — Conditional combinations pass local checks despite provider restrictions

**P2; local acceptance demonstrated; provider rejection probable, not tested.**

- **Veo 3.1:** all three visible Veo pages accept `reference_images` plus
  `param_durationSeconds:4` or `6`. The parent independently prepared
  `instances[0].referenceImages` with `parameters.durationSeconds:4`.
  Google's [Veo 3.1 model card](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate)
  limits reference-image generation to 8 seconds. Constrain Duration by selected
  task/media, preserving the shorter choices where supported.
- **Beeble SwitchX:** `alpha_mode:custom` or `select` succeeds locally without
  `alpha_uri`, although the pinned model description requires it. Clearing
  Prompt also succeeds without a style reference, despite their at-least-one
  rule. Add cross-field validation with errors on the corresponding controls.

Native JSON-Schema acceptance cannot enforce conditions present only in native
descriptions or separate model documentation. No billing/rejection behavior was
tested.

### F05 — Required voice identifiers have no discovery path

**P2; demonstrated UX friction.**

ElevenLabs dialogue's **Voice** and HeyGen Starfish's **Voice ID** are required
plain text fields. Neither offers a supported choice list or a useful route to
obtain an ID. Real provider IDs are valid requirements, not values to invent.
Offer a supported voice picker, or concise inline instructions/link to obtain
the identifier. Real account voice availability was not inspected.

### F06 — Shared field feedback can disappear without fixing the error

**P2; demonstrated in the actual component; new parent finding.**

[workshop-request-callbacks.ts](src/config/workshop-request-callbacks.ts), lines
249–255, correctly rejects Meshy remesh/rigging with both a model URL and a
prior task ID. It attaches `rejected` to both fields.
[PlaygroundField.vue](src/components/workshop/PlaygroundField.vue), lines 49–60
and 197, replaces that cross-field error with single-field validation whenever
the field loses focus. Either source is independently valid, so the error
disappears even though both values remain and the whole request is still invalid.

The parent reproduced this with `meshy--remesh--3d`:

1. Prepare with `model_url:https://example.invalid/source.glb` and
   `input_task_id:prior-task-fixture`; both native-source errors are returned.
2. Render the actual field with those errors and unchanged form values: inline
   alert exists.
3. Dispatch focus-out without changing any value: alert disappears; both errors
   and the form values are unchanged.

The temporary component probe passed by asserting this **buggy behavior**; it
is not a new passing regression test or a fix. Retain cross-field/server errors
until relevant values change and the appropriate validation can reevaluate
them. Focus change alone must not imply correction.

### F07 — Seedance version-specific resolution choices are too broad

**P2; local acceptance/docs mismatch demonstrated; live rejection untested.**

`byteplus/dreamina-seedance-2-0-mini` exposes 1080p and 4K;
`byteplus/dreamina-seedance-2-5-260628` exposes 1080p across its three pages.
The current [BytePlus capability table](https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced)
limits Mini and 2.5 output to 480p/720p and reserves 4K for enhanced 2.0.
The UI forwards the broader native-schema enum unchanged. This is a conflict
between provider documentation and the pinned Router schema, not merely a
dropdown rendering error. Confirm the Router mapping/version and curate its
supported choices; do not infer all options from the shared family enum.

### F08 — Required media still falls back to plain text on some models

**P1 for two Base64-only BFL pages; P2 for the wider media-text cohort;
demonstrated UI limitation.**

The Kling camera-control image-to-video page's `image`, `image_tail` and
`static_mask`, and Runway Aleph 2's required `videoUri`, have no picker/upload
metadata. They therefore ask the user to provide URL/data text despite the
existing URL-plus-file pattern. Preserve legitimate pasted URLs and native
encodings, but expose the appropriate media adapter so users need not host or
encode media themselves. This is distinct from the known backend upload-CORS
problem: these forms do not offer an upload path at all.

The same issue appears on several BRIA/Freepik image inputs and BFL video
upscale. The parent independently prepared requests with `image:holiday.jpg`
for BRIA remove-background, `image:portrait.png` for Freepik Skin Enhancer,
and `input_video:clip.mp4` for BFL video upscale: local validation accepted and
forwarded all three literal filenames. None represents uploaded file contents
or a hosted URL. Add format-aware media validation as well as an appropriate
input widget; provider-specific acceptance was not tested.

Two cases are more serious: `bfl--flux-pro-expand--edit-images` and
`bfl--flux-pro-fill--edit-images` require Base64 image data in their pinned
native descriptions, yet only offer a text box. There is no ordinary media
workflow without manually encoding and pasting data. Wire the file-to-Base64
adapter, preserving distinct image/mask roles. Across the image/3D partition,
15 pages expose 20 media-like text fields; the video partition adds Kling and
Runway pages. See the provider reports for the exact models.

### F09 — Seed Audio help promises unavailable reference inputs

**P3; demonstrated, small in-scope copy correction.**

Both `byteplus/seed-audio-1.0` and `byteplus/seed-audio-1.0-multilingual` tell
users to reference `@Audio1`, `@Audio2`, or `@Audio3`, but expose only the text
prompt. Plain speech works; the help should describe that supported subset
until reference slots exist. Omission of the optional slots alone is not a bug.

### F10 — P-Image is runnable despite the pinned route's availability warning

**P1 risk; demonstrated local contradiction; live availability unconfirmed.**

`ideogram--p-image--generate-images` → `ideogram/p-image-ideogram` has a complete
form and execution contract. The native snapshot's line 71 says the route
requires multipart on v1 and the JSON-only Router path refuses it with
`403 not_enabled`. The parent confirmed normal defaults validate and prepare
a JSON body. This is not an observed live 403; the current deployment was not
queried. Reconcile enablement with the Router owner and mark the page Incomplete
if the pinned limitation still applies.

### F11 — GPT Image offers suspect quality choices, despite valid defaults

**P2; probable provider mismatch; selected values locally demonstrated.**

All three `openai/gpt-image-1`, `gpt-image-1.5`, and `gpt-image-2` forms offer
`standard` and `hd`, which local validation accepts and the composer forwards.
Their actual fresh default is **medium**, not either suspect value.
The [official OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation#size-and-quality-options)
lists the GPT Image quality vocabulary through `high` (plus `auto`), rather
than these DALL-E-style choices. Curate exact-version enums and verify any
Router-specific translation. Live rejection is not claimed; omitting optional
`auto` alone would not be a correctness defect.

### F12 — FLUX.2 sliders permit dimensions outside documented increments

**P2; probable provider mismatch; local invalid-choice path demonstrated.**

`bfl/flux-2-pro` and `bfl/flux-2-max` derive step-1 Width/Height sliders from
integer bounds. The parent reproduced `width:1025` passing both validation and
preparation. [BFL's FLUX.2 Pro/Max guide](https://docs.bfl.ai/guides/prompting_guide_flux2#aspect-ratios-and-resolution)
requires 16-pixel increments. Use valid Resolution presets or a 16-pixel step
with matching divisibility validation. Existing default dimensions are valid;
provider-side treatment of an invalid increment was not tested.

### F13 — Some seeded prompts do not match the actual input state/path

**P2; demonstrated default-content mismatch, not guaranteed provider failure.**

- **Ideogram V4:** `ideogram--v4--generate-images` seeds a large structured
  JSON object into `text_prompt` as a string. The native schema distinguishes
  natural-language `text_prompt` from object-valued `json_prompt`. A concise
  natural-language starter matches the current widget; structured prompting
  needs an explicit adapter to the structured native path.
- **FLUX.2 Max:** its fresh starter asks to replace a sofa using Image 2 and
  place a character from Image 3, but no `input_image*` reaches the fresh
  request. The retained example URLs are not bound to the file controls.
  Use a self-contained generation starter, or deliberately bind the example's
  reference inputs through the real media path when it is selected.

The parent inspected both actual initialized forms and prepared-body keys.
This is why “prompt is nonempty” is necessary but not sufficient.

### S01 — Older Kling versions may inherit an overbroad duration enum

**P2 if confirmed; needs confirmation; not a demonstrated blocker.**

`kling/kling-v1`, `kling-v1-5`, `kling-v2-5-turbo` and `kling-v2-6` offer every
duration from 3 through 15 seconds, like Kling 3. The reviewer could not read
the current client-rendered official API reference; historical/secondary
matrices are insufficient to establish current limits. Confirm exact versions
with the Router/schema owner before changing values. Do not promote this
suspicion to a confirmed provider failure.

### S02 — Recraft style-name/style-ID coexistence needs confirmation

**P2 if confirmed; needs confirmation.**

All 14 Recraft pages expose `style` and `style_id`, and both reach the body
together. The pinned `style_id` description says not to supply both, but the
current public documentation explicitly forbids a different pair: `style_id`
and style **references**. Confirm Router/provider behavior before enforcing
mutual exclusion. This is not evidence that V4 custom styles are unsupported.

### What already looks good

- No duplicate labels, locally invalid initialized values, empty prompt/text
  starters, help over 150 characters, or forms over ten Standard controls in
  the shared census. These thresholds are checks, not guarantees of good UX;
  the inappropriate dialogue starter illustrates the distinction.
- Current Resolution/Size fields are dropdowns, output-count widgets are gone,
  and sampled request paths preserve fixed single-output values, including
  nested Wan/Veo counts. Native string types and separators remain intact.
- Typed dropdown values, selected defaults, inline single-field errors,
  URL/file switching, non-image file cards and simple media serialization have
  focused coverage. Required Advanced Runway seed has a valid default and was
  explicitly **not** flagged.
- Seedance frame ordering and mutual exclusion, Veo Base64/MIME nesting, and
  implemented single-/multi-file callbacks were inspected. That does not prove
  remote upload or provider acceptance.

### Verification and limits

- Parent: existing `PlaygroundField`, `PlaygroundForm`, `FileSourceInput`
  component tests: **30 passed / 3 files**.
- Parent: **1 temporary component probe** reproduced F06; offline composer
  probes independently checked Luma Uni, BFL, P-Image, GPT Image, Veo,
  ElevenLabs and Meshy examples.
- Mixed-media reviewer: **303 passed / 2 files**.
- Image/3D reviewer: **518 passed / 3 files**; 68 complete pages prepared
  offline with synthetic required inputs. Ideogram v3 remained Incomplete.
- Video reviewer: **527 passed / 3 files**. Its test selection overlaps the
  mixed-media run; do **not** add these totals as unique coverage.
- No full suite, browser/render tests, real uploads, credentialed requests,
  paid generations, provider output checks, commits, pushes or PR comments.
  Only review documents were added to the repository during this pass;
  implementation changes that predated the review were preserved.

Live provider acceptance, real voice/task IDs, media geometry/duration, remote
URL availability and hosted-upload CORS remain unverified. Dev-key release
gating and upload CORS are separate already-recorded issues, not new findings
from this model-input review.

### Review corrections and false-positive handling

An initial suggestion that Recraft V4/V4.1 cannot accept any style was
withdrawn after the parent checked the current
[Recraft style documentation](https://www.recraft.ai/docs/api-reference/styles).
Custom styles are supported; named curated styles and custom style IDs must
not be conflated. A local body containing both `style` and `style_id` is not
by itself proof of provider rejection. Do not remove supported V4 custom
styles based on the withdrawn claim.

Detailed reports:

- [Image / 3D families](reviews/2026-09-10-model-inputs/image-3d.md)
- [Video families](reviews/2026-09-10-model-inputs/video.md)
- [Mixed media, audio and dormant structured inputs](reviews/2026-09-10-model-inputs/mixed-media.md)

### Suggested next pass, not performed here

1. Correct task-specific input/default binding (F01), and reconcile the
   contradictory P-Image availability signal (F10).
2. Finish ordinary media entry and the advertised repeatable dialogue/reference
   paths (F02, F03, F08); match starters to the actual supported inputs (F13).
3. Add verified per-model/conditional limits and retain cross-field errors
   until resolved (F04, F06, F07, F11, F12).
4. Improve voice-ID discovery and misleading help (F05, F09). Resolve S01/S02
   with the schema owner before changing behavior based on those suspicions.

Status: **review complete; no implementation fixes applied in this pass.**

### Subsequent seed-default correction

The testers' separate seed report was addressed after this audit. Optional seeds
now start unset and stay out of requests until entered; required seeds remain
validated. See [the correction and verification](MODELS_INPUT_SCHEMA.md#seed-defaults-september-10-correction).
This does not close the other findings above.
