# Models input sanity review: BytePlus, Kling, Luma, Runway, Veo

Date: 2026-09-10. Worktree: `/Users/ben/comfy/ws-16556-content-preview`,
branch `ben/workshop-16556-content-preview`, current uncommitted tree. Read-only
review; no source, Git, browser, upload, secret, or paid-generation mutation was
performed.

## Executive result

The assigned visible census is **48 model/use-case pages over 29 Router IDs**:
BytePlus 23/12, Kling 11/9, Luma 8/4, Runway 3/3, and Veo 3/1. Every visible
form was enumerated through `routerWorkshopModels`, resolved through
`getRouterWorkshopModelDetail(slug)`, and inspected at the actual
`schemaForModel`/`defaultValues`/`validateForm`/`prepareWorkshopRouterInput`
path.

One broad **P1 demonstrated known gap** affects 22 assigned pages: use-case and
alias conditions are not applied to the shared Router-ID form, so several edit,
reference, first/last-frame, audio, and camera-control pages either cannot
express their defining operation or allow Run to prepare a different operation.
This is one shared-root finding, not 22 separate bugs.

New findings are: a **P2 demonstrated** Veo reference-image duration combination
that local validation accepts but Google limits to 8 seconds; a **P2
demonstrated** BytePlus resolution list that exposes 1080p/4K on models whose
current provider table limits them to 480p/720p; a **P2 demonstrated** pair of
required-media fields that still demand URL/data text; and a **P3 demonstrated**
Seed Audio hint that tells users to reference audio samples the form cannot add.
One Kling duration concern remains explicitly **needs confirmation**.

I independently observed the same use-case issue on the four `luma_2/uni-*`
pages (two Router IDs), but those are intentionally excluded from the 48/29
partition because the image/3D reviewer owns `luma_2`.

## Findings

### 1. Shared Router-ID forms ignore task/alias mode and can prepare the wrong operation — P1; demonstrated; known gap

**Root and exact affected scope.** `workshop-router-content.ts:33-60` selects
only `workshopContract(model.routerId)` and `formForContract(execution)` for each
content slug. It does not consume the page's use case or the alias
`nativeDefaults`/`condition`. `workshop-browse-content.ts:108-133` nevertheless
labels every content record with a task derived from its individual use case.
The following assigned pages therefore inherit one common form:

| Router ID                                                                                                                          | Content slug(s) / use case                                                                                                                                                                  | Defining creator input and native path                                                            | Observed form/body impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `byteplus/seedance-1-0-lite-i2v-250428`                                                                                            | `byteplus--seedance-1-0-lite-first-last-frame--animate-images`; `byteplus--seedance-1-0-lite-image-reference--animate-images`                                                               | `last_frame` / `content[].role=last_frame`; `reference_images` / `content[].role=reference_image` | Both pages expose only a required `first_frame`; neither defining input can be supplied. The alias requirements are explicit at `workshop-router-aliases.json:29-31`; the ID-level family is fixed to `mode:image` at `workshop-creator-models.json:39-43` and only adds `last_frame`/references for `mode:mixed` at `workshop-creator-forms.ts:52-66`.                                                                                                                                                                                                      |
| `byteplus/dreamina-seedance-2-0-fast-260128` and `byteplus/dreamina-seedance-2-5-260628`                                           | `byteplus--seedance-2-fast-first-last-frame--animate-images`, `...-reference--generate-videos`, `byteplus--seedance-2-5-first-last-frame--animate-images`, `...-reference--generate-videos` | `first_frame`, `last_frame`, `reference_images` / role-bearing `content[]`                        | All defining media are optional. Default validation succeeds and preparation emits text-only `content`. Alias requirements are at `workshop-router-aliases.json:36-38` and the adjacent 2.5 rows; the callback only checks last-without-first and reference/frame conflict (`workshop-request-callbacks.ts:33-63`), not the page's required mode.                                                                                                                                                                                                            |
| `byteplus/seedream-4-0-250828`, `byteplus/seedream-4-5-251128`, `byteplus/seedream-5-0-260128`, `byteplus/seedream-5-0-pro-260628` | each `...--edit-images` page                                                                                                                                                                | `images` / `image`                                                                                | Edit pages mark reference images optional, validate prompt-only, and prepare no `image`, i.e. ordinary generation (`workshop-creator-forms.ts:68-73`; callback `workshop-request-callbacks.ts:170-181`).                                                                                                                                                                                                                                                                                                                                                     |
| `byteplus/seedream-5-0-pro-260628`                                                                                                 | `byteplus--seedream-5-pro-layer-separation--edit-images`                                                                                                                                    | `images` / `image`; `layer_decomposition`                                                         | Alias requires one source and fixed `layer_decomposition:true` (`workshop-router-aliases.json:44-45`), but the page defaults the toggle to false, makes the image optional, validates, and prepares `layer_decomposition:false` with no `image`.                                                                                                                                                                                                                                                                                                             |
| `kling/kling-v1`, `kling/kling-v1-5`                                                                                               | `kling--camera-control-text-to-video--generate-videos`; `kling--camera-control-image-to-video--animate-images`                                                                              | `camera_control`                                                                                  | Titles/descriptions and alias rows advertise explicit camera moves (`workshop-router-aliases.json:57` and adjacent v1 row), but the flat creator drops the structured camera control. The image page remains generic I2V; the text page prepares an ordinary T2V body.                                                                                                                                                                                                                                                                                       |
| `kling/kling-v2-6`                                                                                                                 | `kling--text-to-video-with-audio--generate-videos`                                                                                                                                          | `sound`, `mode`                                                                                   | The page titled “Kling 2.6 Pro Text-to-Video with Audio” prepares `mode:"std", sound:"off"`; the alias condition requires sound on. This silently omits the page's advertised audio/pro behavior.                                                                                                                                                                                                                                                                                                                                                            |
| `kling/kling-v3`                                                                                                                   | `kling--v3--animate-images`                                                                                                                                                                 | starting `image`                                                                                  | The animate-images page has no image input and prepares exactly the same text-only body as its generate-videos sibling.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `kling/videos-lip-sync`                                                                                                            | `kling--lip-sync-text-to-video--edit-videos`                                                                                                                                                | `input.mode=text2video`, `input.text`, `input.voice_id`                                           | The page instead requires `audio_url`; the callback always emits `mode:"audio2video"` (`workshop-request-callbacks.ts:266-274`). The audio sibling is correct, but the text sibling cannot invoke its advertised mode. Alias requirements are explicit at `workshop-router-aliases.json:60-61`.                                                                                                                                                                                                                                                              |
| `luma/photon-1`, `luma/photon-flash-1`                                                                                             | both `...-image-modify--edit-images` pages                                                                                                                                                  | `modify_image_ref.url` (and optional weight)                                                      | No source-image widget exists. Default bodies contain only prompt/aspect ratio/`generation_type:image`, so they invoke plain generation. The provider's modify example requires `modify_image_ref`; see [Luma Image Generation](https://docs.lumalabs.ai/docs/image-generation). Alias evidence is `workshop-router-aliases.json:69-72`.                                                                                                                                                                                                                     |
| `luma/ray-2`, `luma/ray-flash-2`                                                                                                   | both `...-image-to-video--animate-images` pages                                                                                                                                             | `keyframes.frame0` (optional `frame1`)                                                            | No keyframe input exists and a text-only body validates/prepares. Luma's first-frame examples use `keyframes.frame0`; see [Luma Video Generation](https://docs.lumalabs.ai/ue/docs/video-generation). Alias evidence is `workshop-router-aliases.json:73-76`.                                                                                                                                                                                                                                                                                                |
| `veo/veo-3.1-generate-001`                                                                                                         | `vertexai--veo-3--animate-images`; `vertexai--veo-3-first-last-frame--animate-images`                                                                                                       | `first_frame` → `instances[0].image`; `last_frame` → `instances[0].lastFrame`                     | The first-frame and last-frame widgets are optional on both pages. Both defaults validate and prepare `instances:[{prompt}]`, i.e. text-to-video. The first/last alias explicitly requires both at `workshop-router-aliases.json:116-117`. Google documents first/last-frame generation with a required start image and optional end image generally, while this content alias deliberately requires both; see [Google first/last-frame guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames). |

**Minimal reproduction / prepared-body evidence.** The offline probe used each
actual content slug. Representative successful but wrong bodies were:

```json
// luma--ray-2-image-to-video--animate-images
{"aspect_ratio":"16:9","duration":"5s","generation_type":"video","loop":false,"prompt":"…","resolution":"720p"}

// byteplus--seedream-5-pro-layer-separation--edit-images
{"layer_decomposition":false,"output_format":"jpeg","prompt":"…","seed":-1,"size":"1K","watermark":true}

// kling--v3--animate-images
{"aspect_ratio":"16:9","cfg_scale":0.5,"duration":"5","mode":"std","prompt":"…","sound":"off"}

// vertexai--veo-3-first-last-frame--animate-images
{"instances":[{"prompt":"…"}],"parameters":{"sampleCount":1,"aspectRatio":"16:9","durationSeconds":8,"resolution":"720p","seed":42}}
```

For `kling/videos-lip-sync`, supplying the text page's currently required
video/audio values prepares:

```json
{
  "input": {
    "mode": "audio2video",
    "audio_type": "url",
    "video_url": "https://example.invalid/source.mp4",
    "audio_url": "https://example.invalid/voice.mp3"
  }
}
```

This exact behavior is also asserted at
`workshop-creator-request.test.ts` in “composes BRIA edits and Kling lip sync
from scalar widgets”; the test proves shape but currently does not exercise the
text content slug's semantic requirement.

**Consequence.** Some advertised operations are impossible (Seedance 1
reference/last frame, Kling text lip sync, Luma modify/I2V, Kling camera
control); others allow a paid Run that performs a different operation (prompt-
only edit/animate/reference, audio off, layer separation off).

**Smallest correction.** Add validated per-content-slug overrides before
`formForContract`: required/hidden file inputs, fixed native values, and a
use-case callback option. The request should still converge on the same native
whole-body validator. Add behavioral tests that resolve the actual content slug,
not only the Router ID/legacy redirect.

**Unknowns.** No paid provider call was run. The mismatch itself is fully
demonstrated by page identity, reviewed alias conditions, visible field schema,
and exact prepared bodies. Provider availability and final output quality remain
untested.

### 2. Veo accepts an unsupported reference-image duration locally — P2; demonstrated; new finding

**ID/pages/path.** Router ID `veo/veo-3.1-generate-001`; all three visible slugs
(`vertexai--veo-3--generate-videos`, `vertexai--veo-3--animate-images`, and
`vertexai--veo-3-first-last-frame--animate-images`) currently expose
`reference_images` and `param_durationSeconds`. These serialize to
`instances[0].referenceImages[]` and `parameters.durationSeconds`
(`workshop-request-callbacks.ts:120-151`). Contract line:
`workshop-router-contracts.json:154`; build definition:
`workshop-creator-forms.ts:240-296`.

**Expected versus actual.** Google currently lists 4, 6, or 8 seconds generally,
but explicitly says reference-image-to-video supports **8 seconds only** in the
[Veo 3.1 model card](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate)
and the [Veo API parameter reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation).
The form offers 4/6/8 unconditionally, and the callback/native schema accept 4
or 6 with references.

**Reproduction.** With a PNG reference and duration 4, validation and
preparation succeeded with:

```json
{
  "instances": [
    {
      "prompt": "…",
      "referenceImages": [
        {
          "image": {
            "bytesBase64Encoded": "AAH/Ig==",
            "mimeType": "image/png"
          },
          "referenceType": "asset"
        }
      ]
    }
  ],
  "parameters": {
    "sampleCount": 1,
    "aspectRatio": "16:9",
    "durationSeconds": 4,
    "resolution": "720p",
    "seed": 42
  }
}
```

**Impact / correction.** A user can select a locally valid combination that the
provider documents as invalid. When reference images are present, constrain or
fix duration to 8 (and associate the inline error with Duration); retain 4/6/8
for text and first-frame/last-frame modes. No live rejection was attempted, so
the provider-side response and charging behavior remain untested.

### 3. BytePlus exposes unsupported resolution choices on Seedance 2.0 Mini and 2.5 — P2; demonstrated against current primary docs; new finding

**IDs/pages/paths.** `byteplus/dreamina-seedance-2-0-mini` (one text-to-video
page) exposes `resolution` values `480p`, `720p`, `1080p`, `4k`.
`byteplus/dreamina-seedance-2-5-260628` (three pages) exposes `480p`, `720p`,
`1080p`. These are top-level native `resolution` values. Contract lines are
`workshop-router-contracts.json:39-40`; the ID-level family selection is
`workshop-creator-models.json:21-31`.

**Expected versus actual.** The current BytePlus [Seedance 2.x capability and
billing documentation](https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced)
states that 2.0 Fast and Mini do not support 1080p, that 4K is supported only by
the enhanced 2.0 model, and its 2.5 pricing/capability rows list only 480p/720p.
It also says 1080p is not supported for reference-image scenarios. The form and
pinned schema locally accept the broader choices; notably the pinned description
claims 2.5 supports 1080p, so this is a provider-doc/native-snapshot conflict,
not merely a widget projection typo.

**Impact / reproduction.** Selecting Mini `4k` or `1080p`, or 2.5 `1080p`,
passes the dropdown and native validation and reaches the top-level request
unchanged. These choices are likely rejected upstream. Narrow Mini and 2.5 to
the documented 480p/720p intersection, and additionally keep 1080p out of any
reference-image mode if later enabled for a model that otherwise supports it.
Refresh or annotate the pinned Router contract because its prose/enums disagree
with current provider docs. No live call was made; an undocumented Router-side
translation would be the remaining uncertainty.

### 4. Required Kling/Runway media still uses raw text instead of the available picker/upload path — P2; demonstrated; new finding

**IDs/pages/widgets/native paths.** On
`kling--camera-control-image-to-video--animate-images`
(`kling/kling-v1-5`), required `image` plus optional `image_tail` and
`static_mask` are `text-box` controls holding native string media (`workshop-
input-presentation.json:1764-1790`; contract line 69). On
`runway--aleph2-video-to-video--edit-videos` (`runway/aleph2`), required
`videoUri` is a `text-box` (`workshop-input-presentation.json:2815-2832`;
contract line 143). Neither field has `urlUpload`, so `PlaygroundField.vue`
renders only a text input; no local file card is offered.

**Expected versus actual.** A required image/video should use the media picker
or URL-plus-picker pattern. A user currently must already host the file or
manually manufacture Base64/data-URI text. Runway documents Aleph 2 as video +
text/image and accepts 2–30 second inputs; see [Runway inputs](https://docs.dev.runwayml.com/assets/inputs/).
The tasks remain possible with a suitable public URL, so this is friction rather
than an unusable-task P1.

**Smallest correction / unknowns.** Add an image URL-upload adapter for Kling
and a video URL-upload adapter for Aleph while preserving pasted URL/data forms
that the native schemas allow. Confirm Kling's exact Base64 MIME/size rules
before adding local encoding. Hosted-upload CORS and live provider asset access
remain separately unverified known boundaries.

### 5. Seed Audio help refers to reference slots that are not present — P3; demonstrated; new finding

**IDs/pages/widget/path.** `byteplus/seed-audio-1.0` and
`byteplus/seed-audio-1.0-multilingual`, their two audio pages, `text_prompt` →
native `text_prompt`. The hint says “refer to audio samples as @Audio1,
@Audio2, or @Audio3” (`workshop-input-presentation.json:1218-1239`), but each
creator form contains only `text_prompt`; native `references[]` and all audio
file/URL inputs were intentionally omitted by the scalar simplification
(`workshop-creator-models.json:33-37`, `workshop-creator-forms.ts:313-318`).

**Impact / reproduction.** The default prepared body is only
`{"text_prompt":"Hello from Comfy Router."}`. Users following the hint cannot
attach any `@AudioN` resource, so the instruction is misleading even though
plain text-to-speech works. Remove the reference clause until reference widgets
exist, or add a bounded reference adapter; omission of optional references by
itself is not a finding.

### 6. Older Kling models may inherit the Kling 3 duration union — P2; needs confirmation; new suspicion

**IDs/pages/path.** `kling/kling-v1`, `kling/kling-v1-5`,
`kling/kling-v2-5-turbo`, and `kling/kling-v2-6` expose top-level `duration`
with every string value from `"3"` through `"15"` (contract lines 68-69,
73-74). The same shared native component is used for Kling 3, where 3–15
seconds is expected.

**Why suspicious.** Kling's current official API reference is client-rendered
and could not be inspected beyond its shell in this read-only crawler. Historical
provider material and current secondary API matrices say these pre-3 models
support only 5/10 seconds, while Kuaishou's [Kling 3 launch announcement](https://ir.kuaishou.com/node/11216/pdf)
specifically calls up-to-15-second generation a Kling 3 expansion. This is
consistent with the rubric's warning that a shared provider schema is not proof
that every model version supports every choice, but it is not enough to call a
provider rejection demonstrated.

**Impact / smallest next check.** If the older matrix remains current, 11 of 13
visible duration choices are invalid for each ID. Confirm the exact versions in
the signed-in official Kling API reference or with the Router schema owner, then
narrow to the verified intersection. Do not change this solely from the
secondary evidence recorded here.

## Known-good checks

- All 48 assigned visible pages resolve to a complete schema and were inspected;
  actual defaults/forms were not inferred from packed metadata alone.
- The assigned forms have no output-count widget. Veo preparation includes
  hidden fixed `parameters.sampleCount:1`; the exact prepared body and rejection
  of an attempted hidden override are covered by focused tests. Dormant
  `kling/kling-image-o1` has `defaultInput:{n:1,result_type:"single"}`.
- Seedance request composition preserves ordered MIME-prefixed data URLs and
  correct `first_frame`/`last_frame`/`reference_image` roles. It rejects a last
  frame without a first and rejects references mixed with first/last frames.
  The gap is selecting/requiredness by page, not the role serializer.
- Seedream sends no `image` for text-only generation, a scalar data URL for one
  image, and an ordered array for several; when layer decomposition is manually
  enabled, the callback requires exactly one image.
- Runway Gen4 Turbo has a required first-frame picker and serializes it to
  `promptImage` as a data URL. Gen4 Image preserves ordered references in
  `referenceImages[].uri`.
- Kling avatar has required portrait and audio URL-upload controls; Kling audio
  lip sync composes the correct `audio2video` structure. Kling video extension
  correctly asks for a provider `video_id`, not an interchangeable media URL.
- Veo uses PNG/JPEG-only file inputs, raw Base64 plus sibling MIME metadata,
  rejects last frame without first, rejects references mixed with first frame,
  and keeps 4/6/8 numeric seconds. Current Google docs support 720p, 1080p and
  4K output for `veo-3.1-generate-001`; 4K itself is not a finding.
- Luma Ray keeps native `5s`/`9s` strings, and all assigned Resolution/Size
  controls are real dropdowns with a valid selected default. Different native
  separators/types were preserved.
- Shared census supplied by the parent found no duplicate labels, invalid
  initialized values, unseeded prompt/text fields, overlong help, forms with
  more than ten Standard controls, or slider step/min misalignment. The only
  required Advanced field was Runway seed and it is defaulted.

## Dormant and overlapping coverage

Twenty provider-family Router index IDs were not visible pages and are not
included in 48/29. Three (`byteplus/seed-2-0-lite-260228`,
`byteplus/seed-2-0-mini-260215`, `byteplus/seed-2-0-pro-260328`) are the known
`missing-input-schema` incomplete records and have no contract. The remaining
17 were checked at contract level only:

`byteplus/dreamina-seedance-2-0-260128`,
`byteplus/seedance-1-0-pro-250528`,
`byteplus/seedance-1-0-pro-fast-251015`,
`byteplus/seedance-1-5-pro-251215`,
`byteplus/seededit-3-0-i2i-250628`,
`kling/kling-image-o1`, `kling/kling-v1-6`, `kling/kling-v2-1`,
`kling/kling-v2-1-master`, `kling/kling-v2-master`,
`kling/kling-v3-omni`, `kling/kling-video-o1`,
`veo/veo-2.0-generate-001`, `veo/veo-3.0-fast-generate-001`,
`veo/veo-3.0-generate-001`, `veo/veo-3.1-fast-generate-001`, and
`veo/veo-3.1-lite-generate-001`.

They have no creator adapters because they are dormant; I did not imply their
native/JSON forms are visible. In particular, only the visible Veo 3.1 ID has
the creator fixed-one-output field. The five dormant Veo contracts still have
nested `instances`/`parameters` and would need their own model/version curation
before catalog exposure.

The overlapping `luma_2/uni-1` and `luma_2/uni-1-max` probe found that each
edit page prepares a body without `type:image_edit` or `source`, while native
default `type:image` remains. These four pages/two IDs belong to the image/3D
partition and are not counted or duplicated as an assigned finding here.

## Verification run and missed coverage

- Offline census/probe: `/tmp/models-input-sanity.wFov1I/video-probe.ts` using
  actual page slugs and production preparation code. It enumerated every
  assigned visible page, form field/default/requiredness, default validation,
  and exact prepared body; it also prepared the Veo reference + 4-second body.
- Focused tests: `pnpm --filter @comfyorg/website test:unit
src/config/workshop-creator-request.test.ts
src/config/workshop-router-content.test.ts
src/config/workshop-router-openapi.test.ts` — **3 files, 527 tests passed**.
- Read: root/source guidance, `MODELS_INPUT_SANITY_REVIEW.md`,
  `MODELS_INPUT_SCHEMA.md`, `MODELS_CONTENT_FORMAT.md`, native snapshot,
  curated contracts/presentation, creator generators, request callbacks,
  `PlaygroundForm.vue`, and `PlaygroundField.vue`.
- Primary-doc browsing was limited to the exact current BytePlus, Google, Luma,
  and Runway pages cited above. Kling's dynamic current reference was not
  inspectable; its version-duration concern is therefore not confirmed.
- Not run: browser/render/hydration checks, full suite, typecheck, real storage
  upload, provider acceptance, balance/charging behavior, or paid generation.
  File geometry/duration, remote URL reachability, undocumented provider
  conditions, and live output correctness remain uncertified.
