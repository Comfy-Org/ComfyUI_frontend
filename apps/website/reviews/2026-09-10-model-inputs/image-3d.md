# Image / 3D provider input sanity review

Reviewed the uncommitted tree at HEAD
`2a14a792dd720c72287d1ceba863bc1524842cd6` in
`/Users/ben/comfy/ws-16556-content-preview` read-only. The frozen packed-file
hashes are recorded in `MODELS_INPUT_SANITY_REVIEW.md`. I used the repository
sanity-review rubric as the authority. No paid generation, real upload,
browser/render test, secret inspection, source edit, commit, push, or GitHub
write was performed.

## Findings

### 1. Per-use-case identity is not applied to the executable form/request — P1, demonstrated, known gap

**Scope.** Fifteen visible pages are concretely affected across six shared request families:

- `bfl/flux-3-video`: `bfl--flux-3-image-to-video--animate-images` (`mode=i2v`, keyframes required) and `bfl--flux-3-video-continuation--edit-videos` (`mode=v2v`, `start_video` required).
- `luma_2/uni-1`, `luma_2/uni-1-max`: `luma_2--uni-1-image-edit--edit-images`, `luma_2--uni-1-max-image-edit--edit-images` (`type=image_edit`, source image required).
- `qwen/qwen-image-3.0`, `qwen/qwen-image-3.0-pro`: both `*-image-edit--edit-images` pages (one to three source images required for the advertised edit operation).
- `vertexai/gemini-2.5-flash-image`, `vertexai/gemini-3-pro-image`, `vertexai/gemini-3.1-flash-image`: the three `--edit-images` pages (source image is optional in the shared form, so the seeded edit silently becomes generation).
- `openai/gpt-image-1`, `openai/gpt-image-1.5`, `openai/gpt-image-2`: the three visible `--edit-images` pages have no image input at all and compose the JSON generations shape, despite those exact models supporting an image-edit endpoint.
- `recraft/recraftv3`, `recraft/recraftv4`, `recraft/recraftv4_pro`: `recraft--v3-text-to-vector--generate-images`, `recraft--v4-text-to-vector--generate-images`, and `recraft--v4-pro-text-to-vector--generate-images` do not apply the audited vector selector/default.

**Expected / actual / impact.** The per-use-case page should make its required media and discriminator unavoidable. Instead, `getRouterWorkshopModelDetail` resolves only `workshopContract(model.routerId)` and does not consume the alias's audited `nativeDefaults` or condition ([workshop-router-content.ts:33](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-router-content.ts:33)). The shared schema then drives defaults and validation ([workshop-playground.ts:349](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-playground.ts:349)), and request preparation faithfully composes that shared form ([workshop-request.ts:65](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-request.ts:65)). Thus Run can either perform the wrong task or cannot perform the advertised task.

**Exact reproduction.** The offline probe called `getRouterWorkshopModelDetail(slug) -> schemaForModel -> defaultValues -> validateForm -> prepareWorkshopRouterInput`:

- Both Luma edit pages validate with no source control and produce bodies with neither source nor `type`; their native contract defaults `type` to `image` ([contracts:90](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:90), [contracts:91](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:91)).
- BFL animate and continuation validate and both send `"mode":"t2v"`, with neither keyframe nor `start_video`; the audited identities specify `i2v` and `v2v` respectively ([identity audit:8](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/data/workshop-router-identity-audit.json:8), [identity audit:10](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/data/workshop-router-identity-audit.json:10)).
- Qwen edit validates and prepares `content:[{text: ...}]` with no image; the callback simply includes whichever optional image URLs happen to be present ([creator forms:115](/Users/ben/comfy/ws-16556-content-preview/apps/website/scripts/workshop-creator-forms.ts:115), [callbacks:183](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-request-callbacks.ts:183)). Alibaba's exact Qwen Image 3.0 reference says editing input contains one to three images plus text: https://www.alibabacloud.com/help/en/model-studio/qwen-image-generation-and-editing-api-reference
- Gemini edit validates and prepares only `{text}` under `contents[].parts`, with no `inlineData`; media is optional in the shared creator form ([creator forms:75](/Users/ben/comfy/ws-16556-content-preview/apps/website/scripts/workshop-creator-forms.ts:75), [callbacks:66](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-request-callbacks.ts:66)).
- The OpenAI pages expose only `background`, `moderation`, `output_compression`, `output_format`, `prompt`, `quality`, and `size`; no image/mask input is available ([contracts:116](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:116), [contracts:117](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:117), [contracts:118](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:118)). Official exact-model pages list image input and `/v1/images/edits`: https://developers.openai.com/api/docs/models/gpt-image-1, https://developers.openai.com/api/docs/models/gpt-image-1.5, https://developers.openai.com/api/docs/models/gpt-image-2

**Smallest correction.** Add per-use-case overrides to apply audited fixed values, required/forbidden fields, and media roles before form construction and request preparation. Hide immutable task discriminators. The content record's media should bind to the required request field, not merely appear in gallery metadata.

**Unknowns.** No provider call was made. The local bodies and pinned schema/audit prove task drift; they do not prove the exact provider error wording or billing behavior.

### 2. P-Image is advertised as runnable although the pinned Router route explicitly refuses it — P1, demonstrated, new finding

**ID/path.** Router ID `ideogram/p-image-ideogram`; slug `ideogram--p-image--generate-images`; native JSON paths `/prompt`, `/aspect_ratio`, `/quality`, `/resolution`.

**Expected / actual / impact.** A visible active page with Run should have an invokable Router route. The pinned native schema says this route requires multipart through v1, while Router dispatches JSON and refuses the call with `403 not_enabled` before validation ([native snapshot:71](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/data/workshop-router-openapi.snapshot.json:71)). Nevertheless, the generated contract and active content produce a normal seven-control runnable form ([contract:65](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:65), [content:81](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-display.json:81)). Every Run attempt is therefore expected to fail before reaching Ideogram.

**Reproduction.** Fresh defaults validate and prepare `{aspect_ratio:"1x1", enable_copyright_detection:true, prompt:"A beautiful mountain landscape", prompt_upsampling:"AUTO", quality:"MEDIUM", resolution:"1K", seed:42}`. The impossibility is stated by the pinned route itself; no paid/live call was necessary.

**Smallest correction.** Mark this ID Incomplete/disabled with the reason shown, or omit it from visible browse content until Router supports its content type.

**Unknowns.** Current live Router deployment was not called; the demonstrated result is against the branch's pinned native snapshot, which the review rubric defines as authoritative local evidence.

### 3. GPT Image quality dropdown contains provider-incompatible values — P2, probable, new finding

**IDs/slugs/path.** `openai/gpt-image-1`, `openai/gpt-image-1.5`, `openai/gpt-image-2`; the three `openai--gpt-image-*--edit-images` pages; native `/quality`.

**Expected / actual / impact.** The exact GPT Image quality choices for these three Router contracts should be `low`, `medium`, and `high`. All three contracts expose `low, medium, high, standard, hd` and accept/forward every listed value ([contracts:116](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:116), [contracts:118](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:118)). Fresh defaults are the valid `medium`, so generation remains available, but selecting two apparently supported choices can reach OpenAI with a bad option.

**Reproduction.** After manually selecting the suspect dropdown choices, offline validation returned `{}` and preparation preserved `quality:"standard"`, `"hd"`, and `"standard"` for GPT Image 1, 1.5, and 2 respectively. The official image guide states that earlier GPT Image models support settings only up to `high`, and lists GPT Image 2 as `low`, `medium`, `high`, `auto`: https://developers.openai.com/api/docs/guides/image-generation#size-and-quality-options

**Smallest correction.** Use `low`, `medium`, and `high` for these three IDs;
remove DALL-E-style `standard`/`hd` and do not add `auto` to the quality enum.

**Unknowns.** No live rejection was purchased, hence `probable`, but the composed values conflict with current first-party documentation.

### 4. FLUX.2 width/height sliders accept non-multiples of 16 — P2, probable, new finding

**IDs/slugs/path.** `bfl/flux-2-max`, `bfl/flux-2-pro`; `bfl--flux-2-max--generate-images`, `bfl--flux-2-pro--generate-images`; `/width`, `/height`.

**Expected / actual / impact.** Output dimensions should remain multiples of 16. Both native/curated schemas provide only integer min/max and the form derives a step-1 slider ([contract:14](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:14), [contract:15](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:15)). Local validation therefore treats 1025 as valid and preparation sends it unchanged. A user can select an apparently valid value that the provider documents as invalid.

**Reproduction.** `width=1025` on Pro and `height=1025` on Max each yielded no local error and exact numeric 1025 in the prepared body. BFL's exact FLUX.2 Pro/Max guide states that output dimensions must be multiples of 16: https://docs.bfl.ai/guides/prompting_guide_flux2#aspect-ratios-and-resolution

**Smallest correction.** Supply a 16-pixel step plus divisibility validation (or use a concise curated size/aspect-ratio selector).

**Unknowns.** No live provider request was made. The pinned Router schema itself does not express `multipleOf`, so the provider rejection is inferred from current first-party documentation.

### 5. Required media is still rendered as raw text; two BFL tasks require pasted Base64 — P1 for two pages / P2 for the wider cohort, demonstrated, known media gap

**Scope.** Fifteen visible pages expose 20 media-like values as ordinary text boxes, 19 required: `bfl/erase-v1` (`image`,`mask`), `bfl/flux-pro-1.0-expand` (`image`), `bfl/flux-pro-1.0-fill` (`image`,`mask`), `bfl/video-upscale-v1` (`input_video`), `bfl/vto-v1` (`person`,`garment`); eight BRIA edit/video IDs (`image`, `mask`, or `video`); and both assigned Freepik IDs (`image`). The affected IDs and fields are listed here; the temporary diagnostic census also records each content slug.

**Expected / actual / impact.** Required image/video input should have a file picker or a clearly validated URL path. These contracts have no `media` binding and use `control:"text-box"` ([BFL contracts:13](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:13), [BFL contracts:21](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:21), [BRIA contracts:28](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:28), [Freepik contracts:59](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:59)). A filename such as `holiday.jpg` is accepted as a generic string and forwarded unchanged. Most routes still have the substantial-friction workaround of pasting a public URL, but `bfl--flux-pro-expand--edit-images` and `bfl--flux-pro-fill--edit-images` explicitly require Base64 at `/image`; the core action therefore requires raw Base64 through the UI.

**Reproduction.** `bria--remove-image-background--edit-images` with `image="holiday.jpg"`, `bfl--flux-video-upscale--edit-videos` with `input_video="clip.mp4"`, and `freepik--magnific-skin-enhancer--edit-images` with `image="portrait.png"` all produced no local validation error and forwarded the fake filename. The BFL expand/fill native descriptions require Base64 ([contracts:21](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:21), [contracts:22](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:22)); BFL's exact Fill API reference also documents Base64: https://docs.bfl.ai/api-reference/models/generate-an-image-with-flux1-fill-%5Bpro%5D-finetune-using-an-input-image-and-mask

**Smallest correction.** Add explicit media descriptors/creator adapters with file-to-Base64 encoding for Base64-only fields and upload/URL controls with URI validation for URL-capable fields. Preserve separate image/mask ordering.

**Unknowns.** The cohort count excludes `background_url` on BRIA replace-background because it already has an `image-or-video` upload affordance. Provider-side acceptance of any particular public URL was not tested.

### 6. Ideogram V4's structured JSON starter is serialized into the natural-language field — P2, demonstrated, new finding

**ID/slug/path.** `ideogram/ideogram-v4`; `ideogram--v4--generate-images`; visible `text_prompt` maps to `/text_prompt`, while the native structured path is `/json_prompt`.

**Expected / actual / impact.** Content explicitly tells the user to supply a structured JSON prompt and seeds a large JSON object. The contract distinguishes `text_prompt` (natural language; Magic Prompt) from `json_prompt` (object; consumed directly), but the flat creator exposes only the former and requires it ([contract:64](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:64), [creator forms:313](/Users/ben/comfy/ws-16556-content-preview/apps/website/scripts/workshop-creator-forms.ts:313)). Users see raw JSON in a normal prompt textarea, and Run changes the documented semantic path by sending it as a string.

**Reproduction.** The fresh prepared body contains `text_prompt:"{\n  \"high_level_description\": ...}"` and no `json_prompt`; the JSON starter is in the visible record ([content:88](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-display.json:88)).

**Smallest correction.** Either seed a concise natural-language prompt into `text_prompt`, or provide a validated structured editor that parses and sends the object at `/json_prompt`.

**Unknowns.** Ideogram may partially interpret JSON-looking text, so this is not claimed as a guaranteed provider rejection; the wrong native path and raw-JSON UX are demonstrated.

### 7. FLUX.2 Max's fresh prompt refers to images that are not initially bound — P2, demonstrated, new finding

**ID/slug/path.** `bfl/flux-2-max`; `bfl--flux-2-max--generate-images`; `/prompt` plus `/input_image.../input_image_9`.

**Expected / actual / impact.** A fresh starter should make sense with the fresh form state. The initial prompt instructs the model to replace the sofa with “Image 2” and place the character from “Image 3,” but `defaultValues` cannot seed file controls and the prepared body contains no `input_image*`. The source content does contain three example media URLs ([content:4](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-display.json:4)); they are not applied to the initial request. A user can click Run on a syntactically valid but self-contradictory request.

**Reproduction.** Fresh local preparation produced the sofa-swap prompt, dimensions/settings, and no input image key. `examplesFor` also intentionally emits sample-only entries with `values:{}` ([workshop-router-content.ts:13](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-router-content.ts:13)).

**Smallest correction.** Use a text-to-image starter for the blank form, or safely bind the three retained example images when that example is deliberately selected.

**Unknowns.** The provider may still generate something from the text; the finding is unsuitable default semantics, not schema invalidity.

### Recraft follow-up — P2, needs confirmation (not treated as a blocker)

The earlier broad suspicion that styles are unsupported by V4/V4.1 is **retracted**. Current Recraft documentation says custom `style_id` values can be compatible with V2/V3/V4/V4.1 and style is optional on ordinary V4/V4.1 models: https://www.recraft.ai/docs/api-reference/styles

A narrower interaction remains: all 14 Recraft pages expose both advanced `/style` and `/style_id`; the pinned `style_id` description says “If style_id is provided, style should not be provided,” but local validation permits and the flat callback forwards both ([contract:129](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/content/workshop-router-contracts.json:129), [callbacks:160](/Users/ben/comfy/ws-16556-content-preview/apps/website/src/config/workshop-request-callbacks.ts:160)). The current public page explicitly states mutual exclusion only for `style_id` versus style **references**, not `style` versus `style_id`, so provider rejection of the latter pair is unconfirmed. Minimal defensive correction, if Router/provider behavior confirms it, is conditional mutual exclusion with inline feedback.

## Coverage and known-good checks

- Complete census: **69 visible per-use-case pages / 57 distinct Router IDs / 412 field occurrences** (196 Standard, 216 Advanced). Provider pages/IDs: BFL 14/12; BRIA 9/9; Freepik 2/2; Ideogram 3/3; Krea 3/3; Luma 4/2; Meshy 3/3; OpenAI GPT Image 3/3; Qwen 4/2; Recraft 14/11; Tencent 4/4; Vertex AI 6/3.
- One assigned page is intentionally unavailable, not runnable: `ideogram--v3--generate-images` / `ideogram/ideogram-v3` has no authored input schema. I inspected its incomplete state but did not count it as a composed request. The other **68/68 complete pages** were individually traversed and locally prepared after supplying only required unset scalar controls (plus one Meshy source branch); all locally validated and composed. This is syntax coverage, not live-provider acceptance.
- Every assigned visible field and all eight assigned request paths were inspected: scalar/non-creator plus creator callbacks `flat`, `bfl-video`, `bria-edit`, `meshy-source`, `qwen-image`, `tencent-file`, and `gemini-image`.
- Single-output policy is correct for all assigned contracts that expose a count path: **21 pages / 16 IDs** prepare exactly one (`n:1` for OpenAI/Recraft or `parameters.n:1` for Qwen), with no count widget. No other assigned contract exposes an output-count property.
- Focused unit tests: `pnpm --filter @comfyorg/website test:unit src/config/workshop-router-content.test.ts src/config/workshop-creator-request.test.ts scripts/workshop-input-presentation.test.ts` — **3 files, 518 tests passed**, 1.43s.
- Offline artifacts: `/tmp/models-input-sanity.wFov1I/image-3d-census.tsv`, `image-3d-census.json`, `image-3d-census.ts`, `image-3d-probes.json`, and `image-3d-probes.ts`. No assigned visible page was skipped.

## Assigned Router IDs

- **BFL:** `erase-v1`, `flux-2-max`, `flux-2-pro`, `flux-3-video`, `flux-kontext-max`, `flux-kontext-pro`, `flux-pro-1.0-expand`, `flux-pro-1.0-fill`, `flux-pro-1.1`, `flux-pro-1.1-ultra`, `video-upscale-v1`, `vto-v1`.
- **BRIA:** `fibo`, `image-edit-erase`, `image-edit-expand`, `image-edit-gen-fill`, `image-edit-increase-resolution`, `image-edit-remove-background`, `video-edit-green-screen`, `video-edit-remove-background`, `video-edit-replace-background`.
- **Freepik:** `ai-image-upscaler-precision-v2`, `ai-skin-enhancer-creative`.
- **Ideogram:** `ideogram-v3`, `ideogram-v4`, `p-image-ideogram`.
- **Krea:** `krea-2-large`, `krea-2-medium`, `krea-2-medium-turbo`.
- **Luma 2:** `uni-1`, `uni-1-max`.
- **Meshy:** `animations`, `remesh`, `rigging`.
- **OpenAI:** `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2`.
- **Qwen:** `qwen-image-3.0`, `qwen-image-3.0-pro`.
- **Recraft:** `recraftv3`, `recraftv4`, `recraftv4_1`, `recraftv4_1_pro`, `recraftv4_1_pro_vector`, `recraftv4_1_utility`, `recraftv4_1_utility_pro`, `recraftv4_1_utility_pro_vector`, `recraftv4_1_utility_vector`, `recraftv4_1_vector`, `recraftv4_pro`.
- **Tencent:** `hunyuan-3d-part`, `hunyuan-3d-smart-topology`, `hunyuan-3d-texture-edit`, `hunyuan-3d-uv`.
- **Vertex AI:** `gemini-2.5-flash-image`, `gemini-3-pro-image`, `gemini-3.1-flash-image`.
