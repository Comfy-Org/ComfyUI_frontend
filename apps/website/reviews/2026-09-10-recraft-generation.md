# Recraft image output misclassification

Test: September 10, 2026, 22:37 PDT, on the signed-in TEST preview for PR #17382.
Application head: `6b2f6054aa3f6e42319053859eecb373a8830c6a`.
Case: `recraft--v4-pro-text-to-image--generate-images`.
Router: `POST https://testapi.comfy.org/v2/models/recraft/recraftv4_pro`.
Request ID: `5b0df895-744e-46ed-b0d6-f7844d8dccca`.

## Result

One real generation, no retries. HTTP 200 in 17.991 seconds. Router returned a
finished JSON document with one `data[].url`. The URL is on `img.recraft.ai` and
ends in an image identifier, not a file extension.

The returned asset was fetched and checked separately without another generation:

- HTTP 200, `Content-Type: image/webp`, 4,815,086 bytes.
- Binary signature begins `52494646e6784900574542505650384c` (RIFF / WEBP).
- Chromium decoded it successfully at 2560×1664.
- Visually verified a red ceramic mug matching the synthetic prompt.
- SHA-256: `9a1fbde0b1bf37817559d07a413215ed51d740f78f804011d9bd681e569cb30a`.

This is a valid image. The website instead shows a generic file icon and
`recraft-recraftv4_pro-1.bin`; the output section contains zero native `<img>`
elements. Its download attribute also ends in `.bin`.

## Cause

`src/config/workshop-output-media.ts:38` identifies URL media solely from the
last filename extension. This extensionless URL becomes
`application/octet-stream`; `outputKind()` returns `other`, and
`outputExtension()` returns `bin`.

Recraft uses the automatic JSON output path. At
`src/config/workshop-response.ts:51`, that guessed MIME sets the kind and filename
without checking the asset's actual response type. The generic-file branch in
`src/components/workshop/PlaygroundOutput.vue:326` then renders the file icon.

Replayed the exact captured Router JSON through the actual local
`parseRouterResponse()` with its selected contract: reproduced `other` / `.bin`
plus a JSON metadata attachment. The request also passes the selected input
schema. No application-code changes were needed to prove the defect.

## Reproduction inputs and scope

```json
{
  "n": 1,
  "prompt": "A red ceramic mug on a wooden desk, soft window light, studio product photograph.",
  "size": "2560x1664"
}
```

The prompt was replaced; the page's initial resolution was retained. No seed,
uploads, custom styles, or vector output were used. Only this Recraft variant
and these inputs are confirmed. Its Router output is verified; website end-to-end
presentation is failed, not passed.

The response reports `credits: 250`, which is Recraft's own field, not a verified
Comfy account charge. Observed Comfy cost remains unknown.

## Follow-up

Repair shared output classification for extensionless media URLs using reliable
type evidence (the output contract and/or actual asset MIME), rather than adding
a Recraft filename hack. Preserve unknown-file and active-content handling:
this finding does not justify treating every unknown URL or SVG as a safe image.
The captured response can reproduce this without further paid runs.

Sanitized metadata is in
[the packed attempt record](../testing/recraft-generation-2026-09-10.jsonl).
No application code or CSS was changed. No external review or team message was
posted during this test.
