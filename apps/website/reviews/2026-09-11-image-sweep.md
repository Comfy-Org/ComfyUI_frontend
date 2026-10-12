# Image model verification — September 11, 2026

All 75 published image pages were attempted against production using their
initial page inputs through `router_render(slug, {})`. The latest evidence is
**61 passed and 14 failed**, with no remaining account-capacity blocks.

| Latest outcome                              | Pages |
| ------------------------------------------- | ----: |
| Downloaded and decoded image output         |    61 |
| SVG generated, but page preview unsupported |     7 |
| Router rejected mapped inputs               |     1 |
| Provider or Router error                    |     3 |
| Timed out before verification completed     |     3 |

The first pass ran with account concurrency limited to one: 20 pages passed,
52 received capacity errors, two received input errors, and one lost its
connection before a response. After an administrator changed the account limit,
`GET /customers/me/partner-node-concurrency` returned
`{"limit":200,"reason":"manual_override"}`. The recovery sweep used 32 workers
and at most two starts per second. No generation was automatically retried.

## Fixes verified with real output

- Applied authored task defaults during page initialization. Recraft's raster
  style and Seedream's layer-decomposition setting now reach Router; both were
  verified. Recraft vector style defaults also reach Router, but SVG preview
  support remains outstanding.
- Replaced the shared portrait URL, which served a mountain photograph, with a
  visually verified portrait pinned to Comfy's workflow templates. Magnific Skin
  Enhancer passed with the corrected page default. This also changes Kling
  Avatar's input; its video check is tracked separately.
- Removed an invented OpenAI compression default that conflicts with PNG output.
  GPT Image 1, 1.5 and 2 each passed a fresh generation. Explicit JPEG/WebP
  compression remains supported.
- Added bounded Content-Type discovery for extensionless passive-media URLs.
  Seven saved Recraft raster responses now produce image outputs through the
  shared page parser, and all seven WebP files were downloaded and decoded.
  These parser replays made no new generation requests. Their original Router
  request IDs and artifact hashes remain in the grid.
- Aligned the Node tester's HTTP timeouts with its configured deadline. A fresh
  Magnific Upscaler Precise V2 request passed. The earlier disconnected request
  was not blindly replayed; its remote completion/billing state remains unknown.

## Remaining failures

- Seven Recraft vector pages return SVG. The shared parser deliberately keeps
  active document formats inert, so those pages do not produce a usable image
  preview. This is an output-support failure, not proof that generation failed.
- Bria Generative Fill: HTTP 400 `invalid_input`, request
  `04f213d7-dd7b-4551-a347-3d8c876db3c9`. The supplied PNG image and mask decode
  correctly. The mask is entirely white; Router does not expose the provider's
  precise rejection reason, so the cause is unresolved.
- Byteplus Seedream 3 and both Luma Photon 1 pages returned provider errors.
- Both Luma Photon Flash pages and WaveSpeed Ultimate Image Upscaler timed out.
  An accepted remote generation may still complete after the local check ends.

Beeble's returned media includes an echoed source image and a distinct generated
render. Its pass verifies the generated render; three returned files do not mean
three independent generations.

The persistent [results grid](../MODELS_TEST_RESULTS.md) lists all 154 published
models, plus four historical checks with different environments or inputs. It
retains each latest result and last successful generation. Seven 3D pages are
explicitly untested because the verifier supports image, video and audio only.
No model was automatically disabled.

Private requests, signed URLs and media files are excluded from Git. Test records
identify revision `36e639dcee` plus uncommitted fixes and their campaign IDs.
The website unit suite passed 4,187 tests across 314 files; lint, typecheck, unused
code checks and the frozen lockfile check also passed.
