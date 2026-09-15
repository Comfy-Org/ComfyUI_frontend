# Mixed-media Models input sanity review

Read-only review of the current dirty worktree on `ben/workshop-16556-content-preview`.
I inspected every assigned visible page (41 content slugs / 28 Router IDs) through
`routerWorkshopModels` -> `getRouterWorkshopModelDetail(slug)` ->
`schemaForModel` / `defaultValues` / `validateForm` ->
`prepareWorkshopRouterInput`. I compared the packed creator contract with the pinned
native snapshot and the reviewed alias conditions. Local schema acceptance is used
only as prepared-body evidence, not as provider acceptance proof.

## Findings

### 1. Use-case aliases reuse one Router form and silently execute the wrong request family — P1, demonstrated, known root gap with newly enumerated consequences

The implementation resolves a content slug to one Router contract and one form at
`apps/website/src/config/workshop-router-content.ts:33-59`; it does not apply the
reviewed alias's `nativeDefaults`, `condition`, roles, or per-use-case input/default
overrides. This is the documented known root cause (per-use-case overrides are not
wired), but the following ten visible-page failures are concrete:

- `beeble/switchx`, `beeble--switchx-video-edit--edit-videos`, Standard `generation_type`
  / native `generation_type`: the reviewed alias sets `generation_type: "video"`
  (`workshop-router-aliases.json:3`), but the shared native default is `"image"`.
  Supplying the required source video with no other edits prepares
  `{"alpha_mode":"auto","generation_type":"image","max_resolution":1080,
"prompt":"A cinematic product photo of a glass lamp on a marble table",
"source_uri":"https://example.invalid/input.mp4"}`. The video-edit page therefore
  requests an image unless the user notices and changes Output type. The page also
  starts with the native image/product-photo example rather than a video-edit starter.
  The expected alias default/role is explicit in `workshop-router-aliases.json:3`;
  the shared native contract is `workshop-router-contracts.json:12` and snapshot line 12.

- `wan/wan3.0-video` and `wan/wan3.0-video-prime`, four slugs:
  `wan--image-to-video-3.0--animate-images`,
  `wan--image-to-video-3.0-prime--animate-images`,
  `wan--reference-to-video-3.0--animate-images`, and
  `wan--reference-to-video-3.0-prime--animate-images`. The Router forms are compiled
  once with `mode: "text"` (`workshop-creator-models.json:300-310`), so all four show
  only Prompt, Duration, Resolution and Advanced scalar settings. They show no first
  frame or reference image/video/audio input. A fresh I2V page (whose starter itself
  says “using the input image as the first frame”) prepares only
  `{"input":{"prompt":"..."},"parameters":{"seed":42,"watermark":false,
"prompt_extend":true,"duration":5,"resolution":"720P"}}`; the R2V pages do the
  same despite prompts referring to `@Image1` / `@Image2`. The reviewed alias
  conditions explicitly require `first_frame` or retained reference-media roles at
  `workshop-router-aliases.json:125-128`; the native schema also says I2V/reference
  variants need model-specific media (`workshop-router-contracts.json:188-189`).

- `wan/wan2.7-i2v`, `wan--video-continuation-2.7--animate-images`, Standard source
  media / native `input.media[]`: its reviewed alias requires `type=first_clip` and
  says not to rewrite it as first-frame I2V (`workshop-router-aliases.json:134`). The
  inherited form instead requires **Source image** and the callback emits
  `input.media:[{type:"first_frame",url:...}]` (`workshop-creator-wan.ts:114-129`,
  `workshop-request-callbacks.ts:99-103`). There is no source-video control, so the
  advertised video-continuation task cannot be supplied.

- `xai/grok-imagine-video` and `xai/grok-imagine-video-1.5`, four slugs:
  `xai--grok-imagine-video--animate-images`,
  `xai--grok-imagine-video-1.5--animate-images`,
  `xai--grok-imagine-video-reference--animate-images`, and
  `xai--grok-imagine-video-1.5-reference--animate-images`. The generic form adds one
  optional `image_url` labelled **First frame image** (`workshop-creator-forms.ts:308-311`)
  and the callback can only emit native `image:{url}` (`workshop-request-callbacks.ts:299-301`).
  Consequently the two animate-image pages accept a prompt-only T2V request, while
  both reference pages can produce only T2V or first-frame I2V and can never emit
  `reference_images`. For example, the 1.5 reference page's fresh body contains only
  `aspect_ratio`, `duration`, a prompt referring to `@Image1`, `resolution`; even
  filling its only image control yields `image:{url}`, not `reference_images`.
  `workshop-router-aliases.json:142-143` explicitly requires a nonempty
  `reference_images` array with `image` absent. The native contracts distinguish the
  two fields (`workshop-router-contracts.json:197-198`). The shared 1.5 form also
  leaks 1080p onto the reference content page, although the reviewed scope says 1080p
  is only established for the current text/first-frame path.

Impact: the Run path is enabled after schema validation but either invokes another
task or lacks the task's required media. Smallest correction: bind validated
per-content-record mode/default/input overrides before declaring these pages runnable;
the adapters must emit the alias conditions verbatim. Until then, elide affected
facets or make them Incomplete. Remaining uncertainty: no paid calls were made, but
the prepared bodies contradict both the checked-in reviewed alias conditions and the
pinned native field semantics, so the frontend mismatch itself is demonstrated.

### 2. ElevenLabs Text-to-Dialogue cannot express its advertised multi-speaker input — P1, demonstrated, new finding

- Router ID/content: `elevenlabs/eleven_v3`,
  `elevenlabs--text-to-dialogue--audio`, Standard `text` + `voice_id`; native
  `inputs[]`.
- Expected: the page description promises “a multi-speaker dialogue from a list of
  {text, voice} pairs, up to 10 entries”; the native schema accepts a nonempty
  `inputs` list and separately documents a maximum of ten distinct voice IDs. The
  latter is not itself a ten-utterance cap.
- Observed: creator compilation exposes exactly one Text and one Voice field
  (`workshop-creator-forms.ts:44-50`), and the literal template hard-codes a
  one-element array (`workshop-creator-models.json:2-4`). There is no add/remove row
  control. With a fixture voice, the actual prepared body is
  `{"inputs":[{"text":"Soft ocean waves breaking on a quiet beach, with a gentle breeze in the background.","voice_id":"voice-fixture"}],"seed":42}`.
  Thus it can do single-speaker TTS but not the advertised dialogue task. The content
  record is `workshop-display.json:54`; native/creator contract is
  `workshop-router-contracts.json:55`.
- The starter is also task-inappropriate: because the record has no example text,
  the generic audio starter selected at `workshop-prompt-defaults.ts:56-92` describes
  ocean-wave ambience, so the model will speak a sound-effect prompt rather than begin
  a dialogue.

Smallest correction: repeatable ordered `{text, voice_id}` rows within the native
limits, plus a dialogue starter; otherwise describe and name this as single-voice TTS.
No live ElevenLabs acceptance was tested, but the hard-coded one-element array makes
the missing capability certain.

### 3. Wan 2.7 Reference-to-Video collapses a multi-reference example to one image — P2, demonstrated, new finding

- Router/content: `wan/wan2.7-r2v`,
  `wan--reference-video-2.7--animate-images`, Standard `image_url`; native
  `input.media[]`.
- Expected: content advertises a mix of reference videos and images, and its active
  starter/example supplies two ordered reference images and refers to `image1` and
  `image2` (`workshop-display.json:271`). The reviewed content model allows multiple
  reference images and videos.
- Observed: the `mode:"reference"` WAN form creates one required **Reference image**
  URL (`workshop-creator-models.json:282-286`, `workshop-creator-wan.ts:114-119`). The
  callback always emits exactly one `reference_image` (`workshop-request-callbacks.ts:107-116`).
  Filling the only control prepares `input.media:[{type:"reference_image",
url:"https://example.invalid/one.png"}]` while retaining the two-character starter.
- Impact: a useful single-reference task remains, but the active example and the
  model's mixed-reference promise are not reproducible. Smallest correction: ordered
  repeatable reference image/video inputs with the documented cardinalities, or a
  one-reference starter/description until that exists. No claim is made that every
  optional WAN role must be exposed.

### 4. Beeble exposes conditional modes that pass local validation without their required partners — P2, probable provider failure, new finding

- Router/content: `beeble/switchx`; both SwitchX image/video pages. Controls/native
  paths: `alpha_mode` -> `alpha_uri`, and `prompt` / `reference_image_uri`.
- Expected: the pinned exact-version schema says `alpha_uri` is required when
  `alpha_mode` is `custom` or `select`, and at least one of prompt or style reference
  is required (`workshop-router-openapi.snapshot.json:12`, packed contract line 12).
- Observed: these constraints exist only in descriptions. `validateForm` validates
  each field independently (`workshop-playground.ts:380-445`) and whole-request native
  validation cannot see undocumented JSON-Schema conditionals. Both of these locally
  validate and prepare successfully:
  `{"alpha_mode":"custom","generation_type":"image","max_resolution":1080,
"prompt":"...","source_uri":"https://example.invalid/input.png"}` (no
  `alpha_uri`), and
  `{"alpha_mode":"auto","generation_type":"image","max_resolution":1080,
"source_uri":"https://example.invalid/input.png"}` (neither prompt nor style
  reference).
- Impact: users can select an offered mode or intentionally clear the starter and
  spend a Run on a request the checked-in contract says lacks a required companion.
  Smallest correction: cross-field preflight with errors attached to Alpha matte or
  Prompt/Style reference. Provider rejection is probable from the pinned contract
  prose, but was not confirmed with a paid call.

### 5. Required TTS voices are opaque free-text IDs with no acquisition path — P2, demonstrated UX friction, new finding

- `elevenlabs/eleven_v3` / `elevenlabs--text-to-dialogue--audio`: required creator
  `voice_id` is labelled **Voice**, rendered as a plain text box with no hint,
  suggestion, or selector (`workshop-creator-forms.ts:44-50`).
- `heygen/starfish` / `heygen--starfish-tts--audio`: required `voice_id` is a text box
  labelled **Voice ID**; help only says it must support Starfish. No available IDs or
  lookup route are surfaced.
- Expected: a person can select or locate a real supported voice without knowing an
  opaque provider identifier. Observed: both otherwise-complete pages stay invalid
  until the user obtains and types an ID elsewhere. This is not a request-shape bug,
  and no fake default should be introduced. Smallest correction: a real voice picker
  backed by supported IDs, or concise provider-specific instructions/link explaining
  how to obtain the required ID. Real account voice availability was not inspected.

## Visible coverage and known-good results

Assigned 28 Router IDs:

`beeble/switchx`; `elevenlabs/eleven_sfx_v2`, `elevenlabs/eleven_v3`;
`gemini-interactions/gemini-omni-1.1-flash`,
`gemini-interactions/gemini-omni-flash-preview`; `heygen/starfish`;
`minimax/minimax-h3`; `wan/happyhorse-1.0-video-edit`,
`wan/happyhorse-1.1-i2v`, `wan/happyhorse-1.1-r2v`, `wan/happyhorse-1.1-t2v`,
`wan/wan2.5-i2i-preview`, `wan/wan2.5-t2i-preview`, `wan/wan2.6-i2v`,
`wan/wan2.6-r2v`, `wan/wan2.6-t2v`, `wan/wan2.7-i2v`, `wan/wan2.7-r2v`,
`wan/wan2.7-t2v`, `wan/wan2.7-videoedit`, `wan/wan3.0-video`,
`wan/wan3.0-video-prime`; `wavespeed/flashvsr`, `wavespeed/seedvr2`,
`wavespeed/ultimate-image-upscaler`; `xai/grok-imagine-image`,
`xai/grok-imagine-video`, `xai/grok-imagine-video-1.5`.

- The six Gemini Interactions pages and one MiniMax Hailuo page (three Router IDs)
  have no input schema, render no creator form, and are correctly marked
  `missing-input-schema`/Incomplete. I did not treat them as bugs.
- Every other assigned page had unique field names, and every initialized default was
  type/schema-valid; required user-supplied media and voice fields correctly remained
  blank. No assigned complete page exposed an output count.
  `xai/grok-imagine-image` sends native `n:1`; WAN 2.5 T2I/I2I sends nested
  `parameters.n:1` and rejects a hidden override.
- Dedicated HappyHorse and WAN 2.5/2.6/2.7 T2I/I2I/I2V/T2V/video-edit forms preserve
  scalar types and the checked media shape for their implemented basic path. WAN
  `width*height` Resolution values remain strings. xAI 1.5's base text/first-frame
  path offers 1080p; the earlier version remains 480p/720p.
- WaveSpeed SeedVR2 and Ultimate Image Upscaler require URL-validated images and have
  upload transport metadata; their Resolution and output-format dropdowns have valid
  selected defaults. FlashVSR has required Video and Duration fields and forwards the
  native scalar types. ElevenLabs SFX has a seeded sound prompt, required 5-second
  duration and Advanced prompt influence. HeyGen does not fabricate language/locale.
- Prepared bodies validated against the pinned local Router schema. This proves local
  shape only, not provider acceptance.

## Dormant authored-contract scan (reported separately)

I sanity-scanned 35 authored but currently non-visible contracts: 10 Anthropic, 3
FAL, 5 Moonvalley, and 17 OpenAI non-`gpt-image` IDs.

- These were not elevated as visible-page findings. Before future activation, all ten
  Anthropic contracts still require a JSON **Conversation** editor; all seventeen
  OpenAI Responses contracts require JSON **Inputs** and retain several structured
  Advanced JSON controls. Moonvalley image-to-video and video-to-video-resize use a
  whole **Request Body** editor, while the other three expose JSON Generation
  settings. FAL Patina exposes Material maps as JSON. These are dormant structured-
  widget readiness risks, consistent with the documented remaining work, not current
  user regressions.
- Known-good dormant checks: Anthropic supplies required `max_tokens=1024` and places
  it Advanced; OpenAI o1/o1-pro/o3/o4-mini omit sampling controls rejected by those
  model families; FAL H3 keeps unknown-range Duration as a number rather than inventing
  a dropdown and uses `balanced`/`quality`; Moonvalley video-to-video requires Prompt,
  Input video, and Motion guidance. No live provider semantics were certified.

## Probes/tests run and uninspected work

- `/tmp/models-input-sanity.wFov1I/mixed-media-probe.ts`: enumerated all 41 assigned
  pages and their actual schema/default/error state, enumerated the 35 dormant
  contracts, and prepared representative Beeble, WAN, xAI, and ElevenLabs bodies
  through production request composition.
- Focused tests:
  `pnpm --filter @comfyorg/website test:unit src/config/workshop-creator-request.test.ts src/config/workshop-router-content.test.ts`
  -> 2 files / 303 tests passed.
- I did not run browser/render tests, the full suite, uploads, paid generations, or
  credentialed requests. I did not verify remote URL accessibility, real voice IDs,
  media geometry/duration constraints, or provider-only behavior absent from the
  pinned contract. Dormant provider semantics were only sanity-scanned, not deeply
  certified against current external documentation. No source files, commits, PRs,
  or external state were changed.
