# Models input presentation

Agreed with Ben, September 9, 2026. This is the creator-facing layer over the
Router request schema, not a replacement for the authoritative snapshot.

## Contract

- GOOD: a minimal widget that captures the meaning of the input. BAD: copied
  Router documentation, blank/default-conflicting choices, and raw translation
  artifacts. Labels/help are curated, not copied from Router descriptions.
- Widget definitions are an allowlist: explicit per-model definitions or known
  shared inputs. Unknown optional fields have no widget; declared defaults are
  kept in the request, otherwise the field is omitted for provider defaulting.
- Unknown required scalar fields remain visible as minimal, required controls.
  Missing label curation alone must not disable a model. Required structured
  input is different: making the user author JSON or paste Base64 does not count
  as a usable control. Evaluate a template-backed widget before deciding whether
  that model must be elided from the creator catalogue.
- Each model has a curated set of input definitions: label, help, control,
  Standard/Advanced placement, visibility and default provenance.
- Shared definitions give common concepts the same label/help/placement across
  models. Creator aliases can flatten nested inputs; the adapter restores native
  request names, structure and value types before validation.
- Model overrides may hide an input, change its placement or narrow supported
  options. They must not widen the native request contract.
- Hide integration-only inputs such as callbacks, webhook secrets, task tracking,
  response delivery and routing selectors. Hidden is not another Advanced group.
- Never hide a required user input without an explicit, valid system-owned value.
- Native schema defaults take precedence except for an explicit system-owned
  fixed value (such as one output) or a curated default policy (such as optional
  seeds remaining unset). Otherwise use an explicitly curated,
  validated default, chosen during curation and saved in data, never by a live
  model call when rendering a page. Zero and false are real defaults.
- Show the default beside the input and initialize the actual control to it.
  Dropdown SSR and hydrated state must agree. Prompt fields start with an
  example or predefined starter; media/task references still require real inputs.
  Do not fabricate assets or IDs.
- Defaulted dropdowns have no empty `—` option. A required choice with no usable
  default asks for that specific value; it must not silently submit a fake one.
- The creator form has no Native JSON mode switch. Native validation and API
  serialization remain intact underneath the widgets.
- Common or obvious inputs need only a label. Retain short inline guidance for
  unfamiliar inputs or important model-specific constraints, not help popups.
  Longer necessary guidance wraps inline; it is not clipped to one visual line.

## Prompt starters

On a fresh model page, prefer Rob's nonempty example prompt from reviewed content,
then a declared/native example, then the modality-specific text in
`src/data/workshop-starter-prompts.json`. A short starter handles tighter limits.
Every selected value passes the actual field validation. This is an initial
editable draft, not a changed Router default or a request sent automatically.

Only prompt text crosses from Rob's legacy values into native inputs; seeds,
media, task IDs and operational settings are not copied. Native example
containers such as Seedance's `content` preserve their text structure without
copying sample media. Viewing an output-only sample still preserves the draft.
Saved edits and intentional clears take precedence and are never repopulated
by a watcher. Negative prompts and non-prompt inputs are not given generic text.

Media, voice IDs and task IDs must still come from the creator. The structured
widgets below do not fabricate them, and prompt starters alone do not make
every request valid.

## Seed defaults: September 10 correction

- Optional Seed controls start blank and are omitted from the prepared Router
  request until explicitly entered. Do not prefill `-1`, `42`, or even `0` simply
  because a provider or shared rule supplies a default. Omission delegates seed
  selection to the endpoint.
- The common Seed rule uses `defaultPolicy: "required-only"`. Required seeds
  retain a validated native or curated default; clearing them blocks submission.
  Explicit values, including zero, retain their numeric type and native limits.
  This is not a blanket ban on `-1`: the pinned BytePlus schemas allow it.
- Apply this during contract generation, including nested `parameters.seed`
  projections. Do not strip explicit seed values in the request serializer.
- ElevenLabs dialogue uses a callback so its optional seed can be omitted.
  Replacement templates remain replacement-only; missing tokens are still errors.
- The visible-model audit found 48 Router models with seed controls: 47 optional
  and one required (`runway/gen4_turbo`). Previously 10 optional seeds started at
  `-1` and 37 at `42`. All 47 now start unset. All 436 populated initial values
  (including the required seed) across the 114 visible Router models pass their
  current field schemas.
  Schema validity is not proof of live provider acceptance or conditional modes.
- Previously saved draft values remain user state; clearing a saved seed removes
  it from the next request. Do not erase intentional seeds during restoration.

Regression coverage exercises initial omission, explicit zero, clearing,
required-seed enforcement, native bounds/integers, and the actual Advanced input.
Tests prepare requests locally; no paid generations are involved.

Verification: five focused files passed (1,191 data-driven tests in 3.84 seconds),
website typecheck passed, and type-aware lint passed on the changed TypeScript.
Regenerating the 198 packed contracts twice produced identical bytes (200 lines).
The raw Router snapshot and Rob's display content were unchanged by this fix.

## Controls

| Input                                          | Control                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Bounded number, both minimum and maximum known | Slider, integer or float precision from schema                     |
| Number without both bounds                     | Integer/float number field; retain any known bound                 |
| Short text / URL / identifier                  | Text box                                                           |
| Prompt / longer prose                          | Text area                                                          |
| Structured request input                       | Ordinary widgets bound to an internal JSON template; see below     |
| Closed set of options                          | Dropdown preserving underlying number/string/boolean types         |
| Video duration                                 | Standard dropdown for a known finite set; otherwise a number field |
| Boolean                                        | Toggle                                                             |
| Image / video / audio / other media            | Existing supported media input; no invented upload service         |

## Internal JSON templates and callbacks: integrated locally

September 9 follow-up: nested JSON does not by itself make a model unsuitable.
The creator should see Prompt, Image, Duration and other ordinary controls;
the application can build the provider's nested JSON from a curated template.

- Ben's chosen syntax is `$repl_type("input_id", extra)`: replacement only,
  no logic. This supersedes the proposed JSON Pointer binding configuration.
  Store template text as a string in the packed JSON model definition. A token
  occupies a complete JSON value position, not part of a quoted string or key.
- A small allowlisted set of replacement types reads a named, validated input
  and emits one complete JSON value. String replacement uses `JSON.stringify`,
  including its surrounding quotes; numbers and booleans remain typed. Any
  `extra` argument is literal encoding/format configuration, never an expression.
  Defaults are resolved by the input definitions before replacement.
- Recognize tokens only in the original template. Never evaluate code, recurse
  into inserted values, or rescan user text as replacement syntax. Unknown
  replacement types/inputs, missing values and type mismatches are errors.
  There are no conditions, loops, arithmetic, nested calls or field omission.
- Bind an image picker to the exact nested media value. Use raw Base64, a
  MIME-prefixed data URL or a public URL only as that model's contract permits.
  A file card is a presentation, not an upload/hosting service.
- If logic is needed, use a named callback INSTEAD of the replacement template.
  The registered TypeScript method converts validated inputs to the complete
  Router JSON object. It is not code stored in the JSON, an arbitrary function
  evaluator, or a second template language. Reuse callbacks by request family.
  Conditional media insertion/removal, variable arrays, role/order constraints
  and mutually exclusive modes belong here. No empty placeholder media objects.
- Both paths converge on the same complete-request validation and serialization
  used by Run and snippets. Callbacks do not send requests or bypass validation.
- Preserve curated defaults, hidden operational-field restrictions and native
  whole-request validation. Template validation alone cannot establish live
  availability, real voice/task IDs, file accessibility or provider-only rules.
- If the useful input path still requires manual JSON/Base64 after considering
  a template, decide case by case whether to elide that model until its controls
  exist. Preserve Router schemas and Rob's source content; do not delete data.

Example template text before replacement (the `$repl_*` tokens are not JSON
until replaced; the enclosing model record stores this text as a JSON string):

```text
{
  "content": [{ "type": "text", "text": $repl_string("prompt") }],
  "duration": $repl_number("duration")
}
```

Implemented on September 9 in the local combined preview. The original audit
found 151 JSON controls across 78 visible pages, including nine whole-body
editors. Those 78 audited pages now render ordinary widgets instead of the raw
JSON controls counted by that audit. This does not mean every page in the
historical 114-page catalogue is free of JSON editors: composed root schemas
and nested structured inputs still use JSON editing where no ordinary widget
projection exists. The four missing-schema Incomplete models are unchanged.

Source and runtime responsibilities:

- `src/data/workshop-creator-models.json`: explicit model/family selection.
  `workshop-input-presentation.json` remains the shared vocabulary.
- `scripts/workshop-creator-fields.ts`: build-time widget projection and schema
  resolution. `workshop-creator-forms.ts` and `workshop-creator-wan.ts` supply
  family-specific definitions. No family detection runs in Vue components.
- `src/content/workshop-router-contracts.json`: generated native contracts plus
  `creator.parameters`, `creator.inputs`, `creator.files` and `creator.request`.
  Still 198 records in 200 lines, one packed object per line.
- `workshop-request-template.ts`: one-pass replacement of complete values.
  Types are `string`, finite `number`, `boolean` and JSON. Nonempty `extra`
  configurations are currently unsupported and rejected, not evaluated.
- `workshop-request-callbacks.ts`: fixed, named callbacks for conditional media,
  nesting, arrays and mutually exclusive modes. No network calls or dynamic code.
- `workshop-creator-request.ts`: scalar allowlist, actual files, MIME/count/size
  preflight, cancellation and encoding. `workshop-request.ts` then validates the
  complete native body and enforces the 10 MiB serialized request limit.
  Both API snippets and Run already use this same preparation path.

The 78 updated pages consist of 47 structured-request adapters and 31 simplified
scalar forms. ElevenLabs dialogue initially used a literal replacement template;
the September 10 seed correction moved it to a callback for optional seed
omission. Variable media arrays and optional settings use callbacks; the
scalar-only callback keeps
the useful basic mode without offering unsupported optional JSON structures.
Those omitted structures are not claimed as completed capabilities (for example,
multi-shot/storyboard, specialist reference arrays or free-form style objects).

The native Router snapshot, model IDs, Rob's content, aliases and catalogue
membership were not changed. A source-only compiler split was checked by
regenerating the same packed file byte-for-byte. Generated contracts SHA-256:
`bb44033ac0efd35fb08a58e054c0256af45de04d97e61ac4557cb4577b0b28dd`.

### Request details worth preserving

- Seedance frame/reference images use MIME-prefixed data URLs. Last frame needs
  a first frame; reference-image mode cannot be combined with first/last frames.
- Gemini uses `contents[].parts[]`, raw Base64 in `inlineData`, and separate MIME
  metadata. Sampling and image options go under `generationConfig`. Gemini 2.5
  has aspect ratio but no image-size picker; the shared Router shape is broader
  than that model. See [Google's model-specific image guide](https://ai.google.dev/gemini-api/docs/image-generation).
- Veo uses `instances[]` and `parameters`; image bytes and MIME are siblings.
  Its image widgets accept PNG/JPEG, not WebP, matching the pinned native schema.
- Qwen, BRIA and WAN URL widgets preserve public URLs. Tencent keeps a 3D file
  URL/type together and can encode a reference texture image as raw Base64.
  An image replaces its prompt; PBR with an image is rejected explicitly.
- BFL video uses raw Base64 keyframes, enforces i2v/v2v source requirements,
  and requires a fixed duration for more than two keyframes.
- Runway first frames and reference images use data URLs. Seedream emits no
  `image` key for text-only requests, one string for one image, or an ordered
  array for several; layer decomposition requires exactly one image.
- Meshy remesh/rigging requires exactly one model URL or existing task ID.
- HappyHorse needs more than the shared WAN validation floor. Its
  [first-frame API](https://www.alibabacloud.com/help/en/model-studio/happyhorse-image-to-video-api-reference)
  uses `media` rather than `img_url`;
  [reference mode](https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference)
  uses `reference_image`; and
  [editing](https://www.alibabacloud.com/help/en/model-studio/happyhorse-video-edit-api-reference)
  requires a video, permits an optional reference image, and derives duration
  from the source rather than a duration control. The form uses the intersection
  of documented provider options and the pinned Router schema.

### Focused verification, not a launch certification

`workshop-creator-request.test.ts` checks all 78 forms plus exact request shapes,
escaping, typed Advanced values, missing/conflicting inputs, MIME restrictions,
unchanged input objects, cancellation and size rejection before byte allocation.
`workshop-request-template.test.ts` rejects expressions, unknown tokens, invalid
types and rescanning of user text. The existing contract example and deterministic
generation tests still pass. Full-site tests remain deferred while tuning inputs.

Actual built-page browser checks cover Seedance, Gemini, ElevenLabs, Veo, Qwen,
Tencent and HappyHorse: decoded image previews, exact bytes/text in snippets,
Advanced edits, a friendly title, and no horizontal overflow at 390px/1280px.
Zero page exceptions and zero paid requests. No fixture route or mock-data panel
was added. Live provider availability, real voice/task IDs, external asset access,
image/video geometry and provider rules missing from schemas remain live-validation
work; schema acceptance does not certify them.

## Image-source controls (local input-tuning pass)

- Existing file-enabled BFL inputs now use an image picker: choose or drop files,
  decoded previews, replace in place, and remove individual images. Multi-image
  additions append in order. Replacement preserves that image's Router target.
- MIME, per-file size and model-specific image-count limits are checked before
  changing the selection. A rejected selection shows a localized inline error
  and keeps the previous images intact. Cancelling the picker changes nothing.
- The form retains actual `File` objects. Preview blob URLs are revoked on
  replacement/unmount and never become request values. The existing request
  builder handles native base64 encoding and the combined 10 MiB request limit.
  Uploads are not saved across reloads; a preview URL alone is not an upload.
- Original upload coverage: `bfl/flux-2-pro`, `bfl/flux-2-max`, `bfl/flux-kontext-pro`,
  `bfl/flux-kontext-max`, `bfl/flux-pro-1.1`, `bfl/flux-pro-1.1-ultra`.
- `wavespeed/seedvr2:image` and `wavespeed/ultimate-image-upscaler:image` are
  explicitly tagged `imageSource: "url"` and `urlUpload: "image"`. Their authored
  schemas require URLs. Show a URL field plus the existing file picker. Selected
  files use the temporary-storage transport below; pasted URLs pass through.
  The curated `http-image-url` format is validated both in the form and by the
  request builder, including whole-body input. It rejects local paths, blob/data
  URLs, missing hosts, credentials and unescaped whitespace/backslashes.
- Preview failure is an inline notice, not proof that a model request would fail:
  remote hosts can restrict browser previews. No external URL availability or
  paid model success is claimed by the local fixture-based browser checks.
- The earlier Base64 pass added creator upload widgets to 16 more visible models
  (22 total). URL-upload coverage is counted separately below. Do not infer
  encoding from field names or imply that every media mode is implemented.
- Non-image files (FBX, other 3D assets, audio, video, or unknown formats) use a
  compact file card with type/extension, filename, size and replace/remove actions.
  Only image MIME types use the image preview. A non-image `previewUrl` is never
  passed to an image decoder. `FileSourceInput.vue` now handles both cases.
- The visual fallback does not widen a model's accepted types or add a Router
  file transport. An unrestricted file field can retain an FBX; an image-only
  field still rejects it. Unsupported/nested file bindings remain separate work.

Focused checks: `FileSourceInput.test.ts`, `ImageSourcePreview.test.ts`, image
cases in `PlaygroundField.test.ts` and `workshop-router.test.ts`. The two-page
browser check verifies decoded previews, add/replace/remove, exact base64 and
URL values in generated requests, and 390px/1280px layouts. No paid Run clicks.
Non-image cards are additionally checked in an isolated component fixture using
the site's built CSS, including FBX → image replacement. No fixture route or
mock-data panel is added to the website.

### Temporary URL uploads (September 10)

`urlUpload` in the curated input definitions explicitly selects `image`, `video`,
`audio`, `image-or-video`, or unrestricted `file`. It is separate from native
Base64/data-URL bindings. The packed contracts currently expose 43 such inputs
on 31 models: 27 image, 6 video, 2 audio, 2 image/video and 6 general-file inputs.
The native Router snapshot remains unchanged. Regenerate the packed contracts
with `pnpm --filter @comfyorg/website generate:workshop-router-contracts`.

- A URL field accepts either its existing string value or an actual selected
  `File`; changing source replaces the old value. The selected file stays local
  until Run. API-tab rendering never reads private bytes or starts uploads.
- Run validates inputs and obtains a fresh same-user/workspace credential, POSTs
  filename and MIME to `/customers/storage`, PUTs raw bytes to `upload_url`, and
  substitutes `download_url` before the existing template/callback composes and
  validates the native Router body. Use the configured Router environment.
- Storage PUTs omit cookies and Comfy authorization and refuse redirects. Only
  HTTPS storage URLs without embedded credentials are accepted. UUID-prefixed
  filenames prevent distinct same-named images overwriting one another.
- Successful uploads are cached by actual File identity and account/workspace
  scope for at most 23 hours (the backend signs downloads for 24 hours). Failed
  or cancelled uploads are not cached. Retrying unchanged Run inputs therefore
  reuses the composed body and idempotency key while the URL is valid.
- File MIME/count/25 MiB limits apply before upload; the 10 MiB serialized Router
  body cap still applies after composition. Upload failure is localized inline
  and blocks paid generation. Sign-out/workspace changes abort pending work.
- Multiple Qwen reference inputs become ordered native image entries; Base64
  arrays and first/last-frame mappings remain unchanged. This does not add every
  optional provider media mode or override provider-specific limits.
- Python/TypeScript examples use the same storage handshake for URL files and
  local Base64 encoding for Base64 files. cURL continues to omit local files and
  marks the request incomplete. For script retries, reuse the prepared URLs and
  key; rerunning upload setup creates different request URLs. Signed URLs and
  keys must not be logged, checked in, or put into the content pack.

**Live verification is blocked, not certified.** On September 10, both
`api-nodes-prod` and `api-nodes-staging` returned HTTP 200 without any
`Access-Control-Allow-*` headers for PUT preflights from `https://comfy.org`,
the PR #17263 preview, and `http://localhost:4321`. HTTP 200 alone is not a
successful CORS preflight. A storage owner must configure allowed browser
origins/methods (`PUT`, plus `GET`/`HEAD` for previews) and `Content-Type`, then
verify a real signed upload and download in a browser. No bucket configuration
was changed. Local-only draft Playwright tests exercise the UI with mocked
responses; they are not part of this preview update. Neither real storage
uploads nor paid provider calls have been certified by this pass.

Focused regression coverage lives in `workshop-url-upload.test.ts`,
`workshop-url-input.test.ts`, `PlaygroundField.test.ts`, `ModelDetail.test.ts`,
`ApiTab.test.ts`, and `models-snippets.test.ts`. The generated Python/TypeScript
examples are executed with real local fixture bytes against stubbed endpoints,
including distinct ordered uploads, no auth forwarding, mixed URL/Base64 bodies,
and upload failure preventing generation. This does not replace live CORS tests.

### Paused local-only API-key generation and browser tests (September 10)

This separate draft remains uncommitted and is not included in the preview.
Its local `e2e-models/README.md` contains the repeatable commands.
`test:e2e:models` runs isolated browser regressions; `test:e2e:models:live`
explicitly opts into up to two paid requests using `COMFY_KEY`, with the real
Router and real storage CORS. It requires a generated output that actually
decodes, not just HTTP 200 or the example already on the page. Normal website
CI remains network-isolated and never runs these paid tests.

The **Development API key** control is intended for dev mode on exact loopback
hosts. Its release boundary is NOT yet verified: the compiled-preview test
failed with inherited `NODE_ENV=development`, which made `import.meta.env.DEV`
true in the build. Replace this boundary with an actual dev-server signal and
rerun the release check before pushing that separate, paused slice.
It keeps a manually applied key in component memory, never in storage or
a public env variable, and clears the password input immediately. Clearing it
cancels pending work. An opaque key-activation ID scopes cached uploads/retries;
the key is never part of a request fingerprint. Signed-in flows still use the
account package and `ensureFresh`; there is no fabricated Firebase identity or
automatic fallback from failed sign-in. Router, not the website balance, checks
the explicit key's credits. The compiled-preview test must prove that this
control is absent even on localhost; it is currently a known failing check.

Browser tests also exposed a pre-existing fullscreen-output Teleport hydrating
against Astro's body-level style element. Mounting the Teleport only when its
dialog opens avoids touching that SSR node. Generation tests assert no hydration
errors and exercise fullscreen open/close.

## Shared placement

Standard: prompt, main input text/media, resolution, width/height,
aspect ratio, duration, voice and language. Output count is not a user control.

Advanced: negative prompt, random seed, guidance/creativity/steps, sampling,
quality/encoding, camera/motion refinements and optional specialist controls.
Required model-specific inputs remain Standard unless explicitly overridden.

Operational controls are hidden. Media definitions remain in the schema even
if some upload UI is deferred for V1; required unsupported media must not be
silently omitted. Native JSON is the wire representation, not a creator-facing
fallback for missing controls. Public URLs are usable inputs where verified.

## September 10 input pass

All supported Size/Resolution presets use the label **Resolution**, a dropdown,
and a selected valid default. Native values stay unchanged on the wire: Qwen
and Wan use `width*height`, OpenAI and raster Recraft use `widthxheight`, and
other models accept their documented `1K`/`720p`-style choices. Vector Recraft
uses aspect ratios. Separate width/height controls remain where no verified
resolution preset exists; do not invent a closed list from arbitrary bounds.

The generated audit finds no output-count controls across 198 contracts. All
60 Resolution/Size controls across the current visible Router models are
dropdowns. These are local generation/component/request checks, not paid
provider acceptance tests.

The `fixed` presentation rule validates an explicit system-owned scalar against
the native property, hides its widget, and constrains its schema with `const`.
Top-level values travel through `defaultInput`; flattened callback inputs use
`creator.fixedValues` before native request composition. Neither path accepts a
user override through a hidden widget. This keeps `n`/`count`/`num_images` and
Veo's nested `sampleCount` at one, including Wan's native four-output default.
Seedream's supported image-series control is fixed to `disabled`; Kling O1 uses
`result_type=single` without a series-length control. This is the creator UI's
single-output policy, not a limitation imposed on Router's public API.

Choices are narrowed from the pinned Router snapshot and provider documentation:

- [Recraft size appendix](https://www.recraft.ai/docs/api-reference/appendix):
  model-specific raster sizes and vector aspect ratios, including Pro sizes.
- [BytePlus image API](https://docs.byteplus.com/api/docs/ModelArk/1824121):
  Seedream generation-specific sizes. The pinned 5.0 Lite snapshot is narrower
  than the current provider page; keep the supported intersection (2K/3K).
- [xAI video generation](https://docs.x.ai/developers/model-capabilities/video/generation):
  480p/720p; 1.5's current text/first-frame path also supports 1080p. Do not
  apply that choice to a future reference-video adapter without its own check.
- [Qwen image API](https://www.alibabacloud.com/help/en/model-studio/qwen-image-generation-and-editing-api-reference)
  and [Wan image editing](https://www.alibabacloud.com/help/en/model-studio/wan2-5-image-edit-api-reference):
  preserve the `*` separator and each model's bounds. Wan T2I starts at its
  declared 1280×1280 default, not the old undersized 1024×1024 override.

Content identity and unfinished per-use-case widget customization are documented
in [Models content format](MODELS_CONTENT_FORMAT.md). Live render tests remain
paused while these input definitions are tuned.

## Verification boundaries

During input tuning, use a short change → focused test/browser check → fix loop.
Do not run the full website suite after each adjustment. Hold the broad suite
until the inputs are dialed in; do not disable tests or change CI coverage.

Validate selected defaults/options against the model's schema; do not assume
that the first enum item is a good default. Preserve unedited defaults, explicit
clears, Advanced values and typed dropdown values. Check hidden fields at request
preparation as well as rendering, including restored values and Native JSON.

Some Router schemas cover multiple model versions. Seedance 2.0 Fast, for
example, must not inherit 2.5-only output options. Record such restrictions in
curated model data with their evidence, not as name-matching rules in a component.

## Completed schema-backed curation pass

Three independent audits covered all 198 authored contracts in the pinned
207-ID Router snapshot (`411500bd8c93a97328cf1a927b40ad5b24c60026`):

| Group                                                  | Models reviewed |
| ------------------------------------------------------ | --------------: |
| Video providers, including their image/audio endpoints |              83 |
| Image and 3D providers                                 |              64 |
| Text, speech and multimodal providers                  |              51 |

The authored source is `src/data/workshop-input-presentation.json`: 105 shared
definitions covering 195 native field names, plus model-specific overrides for
164 Router IDs. Models already covered by shared definitions do not get copied
rules merely to mark them reviewed. The native snapshot, identity joins, Rob's
content and catalog membership are unchanged.

At that same `411500bd8c93a97328cf1a927b40ad5b24c60026` snapshot,
`pnpm generate:workshop-router-contracts` produces 198 contracts in 200 lines
(`[` + one object per model + `]`). The resulting metadata has 540 Standard and
667 Advanced definitions, including native media targets represented by upload
helpers. Another 415 field occurrences are explicitly hidden because they are
operational, unsupported on that version, or deprecated. Every ordinary required
field now has a shared or model-specific definition; composed bodies remain the
separate limitation below. The generic required-field fallback is still tested
and remains available for future schemas.

Six optional field occurrences deliberately remain without widgets:

- `bfl/flux-3-video:draft_cache` needs the conditional enhancement mode below.
- `optimize_prompt_options` and `sequential_image_generation_options` on
  `byteplus/seededit-3-0-i2i-250628` and `byteplus/seedream-3-0-t2i-250415`, plus
  `sequential_image_generation_options` on `byteplus/seedream-5-0-pro-260628`,
  are not advertised as supported for those versions. None declares a default.

### Corrections pinned by data and tests

- Luma Ray durations retain native `5s`/`9s` strings, render as readable seconds,
  and use real dropdowns. An outer enum closes an otherwise open string union.
- BFL's single-variant scalar wrappers now render ordinary number, toggle, text
  and dropdown widgets. Only wrappers with annotation-only siblings are
  unwrapped; additional validation constraints and multi-branch schemas remain
  intact. Cyclic aliases are rejected.
- Kling no longer injects shot-planning fields while multiple shots are off.
  Older variants hide unsupported sound/voice fields. Generation quality is an
  explicit Advanced control.
- Seedance/Seedream options and defaults follow their documented versions;
  shared schemas do not imply every field is supported by every version.
- Shared seed curation uses `42`, not an assumed random sentinel. Only the nine
  Seedance IDs whose native description explicitly defines `-1` as random get
  that curated value. Declared native defaults always take precedence.
- OpenAI reasoning IDs explicitly documented as rejecting sampling controls no
  longer receive temperature/top-p defaults. Output structure is not mislabeled
  as speech text. Deprecated image style controls are hidden.
- ElevenLabs/HeyGen language inputs no longer submit a fabricated `auto` code.
  Voice and style IDs are supplied by the creator, never made-up defaults.
- FAL H3 uses the documented `balanced`/`quality` prompt-expansion vocabulary.
  Ideogram uses model-specific dimension/quality vocabularies, not generic 720p.
- Recraft does not automatically send a conflicting style name alongside a
  creator's style ID. Kontext does not force a square aspect ratio when omitted
  should preserve the source image's shape.
- BRIA transparent video defaults to an alpha-capable codec. The pinned schema
  lists the codec and requires alpha for transparent backgrounds; the
  [provider documentation](https://docs.bria.ai/video-editing/editing-endpoints/remove-background)
  identifies `webm_vp9`, `mov_proresks` and `mkv_vp9` as alpha-capable.

The tests validate native field membership, selected defaults/options, preserved
wire types, exact request preparation, hidden-field rejection, required fallback
behavior and deterministic packed output. A new or renamed Router ID cannot
silently leave an orphaned model-specific widget definition in the test suite.

## Remaining structured-input work

These are current renderer limitations, not proof that the models are inherently
unusable. Try an internal template with ordinary controls first; if an essential
input still cannot be supplied, decide whether to elide that model for now.
Never invent fields/values. The existing JSON editors described below remain in
the implementation until template-backed controls replace them; this pass does
not certify every provider combination or paid execution.

- **Composed root schemas:** `meshy/meshy-5`, `meshy/meshy-6`, and `meshy/meshy-7`
  use preview/refine branches. `moonvalley/image-to-video` and
  `moonvalley/video-to-video-resize` use composed object schemas. They retain
  the minimal required, validated request-body editor. A branch-aware form is
  needed to expose their individual widgets; do not flatten away branch rules.
  Meshy preview needs mode/prompt/art style/pose/symmetry/remeshing/topology and
  polygon count; refine needs a real preview task plus texture settings.
  `ai_model` is system-owned, `is_a_t_pose` is deprecated, ultra mode is Meshy 7
  only, and Meshy 5 supports 2K textures only.
- **Exclusive input sources:** `meshy/remesh` and `meshy/rigging` have curated
  root-field metadata but still use the whole-body editor because their oneOf
  selects a source task ID versus model URL. Their widgets need to retain that
  exclusive choice when the renderer supports them.
- **Nested widgets:** Gemini generation settings, ElevenLabs dialogue/voice
  settings, Qwen/Wan input objects, and other structured fields still use minimal
  schema-validated JSON controls. Scalar metadata is not a structured editor.
- **Nested operational fields:** the six Veo models' `parameters` contain
  `storageUri` (and, except Veo 2, `pubsubTopic`). The three Imagen models'
  `parameters` also contain storage/response-metadata selectors. These mixed
  JSON objects cannot yet hide individual nested keys. Do not claim that all
  operational input is blocked: top-level filtering is implemented; nested
  filtering remains open. Kling 3.0 Turbo's optional mixed `options` object is
  hidden wholesale, including its watermark setting, until it can be split.
- **Nested/version constraints:** Seedance 2.0 Mini lacks its own documented
  duration/resolution/audio support. Seedream 4.5/5.0/5.0 Pro prompt optimization
  must use standard, not the shared nested fast option. Runway Gen4 Turbo's
  image position must be first, not the retired Gen3 last-frame option. Kling
  shot planning and several media-source choices need conditional validation
  beyond help text; broad shared native schemas are validation floors.
- **FLUX 3 draft enhancement:** the `draft_enhance` mode takes a real draft
  cache and must omit other generation parameters. The current mode dropdown
  exposes t2v/i2v/v2v; adding enhancement requires conditional omission of the
  normally initialized generation settings, not a fabricated cache ID.
- **Unknown ranges:** FAL H3 duration has a declared value but no verified
  finite set or bounds. It stays a number field, not an invented dropdown.
- **Availability is separate:** `ideogram/p-image-ideogram` has an authored
  schema whose description explicitly says the Router route returns
  `not_enabled`. Keeping its schema does not prove it is callable. Schema-less
  IDs, live deployment/auth/CORS and bounded paid verification remain separate.
