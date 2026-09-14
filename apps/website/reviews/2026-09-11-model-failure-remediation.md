# Model failure remediation — September 11, 2026

The follow-up resolved 22 of the original 29 live failures. The production
[results grid](../MODELS_TEST_RESULTS.md) now contains 139 verified media-page
passes, seven live failures, and one missing-prerequisite page. It also retains
all seven published 3D pages as unsupported by this image/video/audio verifier.

| Modality | Pages | Passed | Live failure | Preflight failure | Unsupported |
| -------- | ----: | -----: | -----------: | ----------------: | ----------: |
| Image    |    75 |     74 |            1 |                 0 |           0 |
| Video    |    67 |     61 |            5 |                 1 |           0 |
| Audio    |     5 |      4 |            1 |                 0 |           0 |
| 3D       |     7 |      0 |            0 |                 0 |           7 |

Every pass has a downloaded, decoded artifact with byte count, digest and
dimensions or duration. Inputs still come from the real first-render page state
and shared parameter mappings. No test-only prompt or source substitutes were
used to produce these passes. The results describe the local changes tested
against production Router; they do not claim a frontend deployment.

## What was fixed or recovered

| Original failures                                  | Count | Cause and result                                                                                                                                                                                                  |
| -------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recraft vector pages                               |     7 | Valid SVG lacked a preview. The page and tester now use the same bounded browser SVG-to-PNG renderer. All seven saved responses decoded without another generation.                                               |
| Bria GenFill                                       |     1 | The all-white mask was rejected. A partial mask generated an image, then exposed an overly strict response schema for nullable `refined_prompt`. Both are fixed and the recovered response decoded.               |
| Gemini video editors                               |     2 | The provider rejected HTTP video inputs. The shared file adapter now supplies inline video bytes; both pages generated valid videos.                                                                              |
| Seedance 2.5 frames and Fast reference             |     2 | Authored photographic human inputs were unsuitable for these routes. Pinned robot images and matching visible prompts passed. The 2.5 result required late-job collection.                                        |
| Wan 3 image/reference pages                        |     3 | The provider rejected literal `@` in media URLs. The shared input path downloads those sources and uses ordinary Comfy temporary storage. All three passed, preserving reference order and retry upload identity. |
| Kling text lip-sync                                |     1 | Default speech produced less than two seconds of audio. A longer visible default sentence passed with the same valid voice/language settings.                                                                     |
| Photon 1 generation/edit and Seedance Mini         |     3 | Upstream job failures and one generated-audio policy rejection. One controlled retest each passed with unchanged defaults; Mini audio remained enabled.                                                           |
| Photon Flash generation/edit and Ultimate upscaler |     3 | Jobs completed after Router returned 504. Original keys and exact request bodies collected the existing jobs; all three artifacts decoded.                                                                        |

The previously passing Seedance Fast first/last-frame page also lacked its last
frame. It now submits both displayed frames and passed a separate live test.
Luma output selection now accepts only the generated `assets.image`; echoed
input images cannot manufacture a pass or appear as another generated image.
All four Photon results were rechecked with that selector.

## Remaining failures

- Five retired versions: four Seedance 1.0 Lite pages and Seedream 3. They need
  explicit catalogue withdrawal or separately named, tested replacements.
- ElevenLabs Sound Effects: Comfy injects `eleven_sfx_v2`, which the provider
  rejects. A tested [backend patch](patches/elevenlabs-sound-model-alias.patch)
  translates the outbound ID while preserving public routing and billing.
  It has not been deployed; the page remains failed.
- BFL continuation: both URL and documented Base64 MP4 inputs return provider
  `Invalid or corrupted image input`. The unsuccessful transport experiment was
  removed. This page remains failed pending a demonstrated provider/input fix.

Kling extension is a separate preflight failure: it requires a real prior Kling
`video_id`. The tester does not invent an ID or silently buy a prerequisite job.

Provider references, exact errors, request IDs, and production log links are in
the [backend investigation](2026-09-11-backend-model-failures.md). Availability
was not automatically changed from these results.

## Late completion and verification limits

Four passing cases required a second collection request after an initial HTTP
504: both Photon Flash pages, Ultimate upscaler, and the corrected Seedance 2.5
first/last-frame page. Logs confirmed parked-job adoption and collection with
the original provider IDs. These are verified outputs, not successful completion
within the first synchronous page request. Automatic late-result delivery in
the page remains follow-up work.
The grid explicitly labels these four passes `Collected after initial timeout`,
and that completion evidence survives partial runs and report regeneration.

Retests after transient failures establish that those defaults can work; they
do not establish that the provider failure cannot recur. The public JSON retains
the last successful artifact while each private campaign retains its failures.

The SVG renderer has real Chromium coverage for script/network isolation,
document and pixel limits, cancellation, and Blob cleanup. Input regressions
exercise temporary storage, stable retry bodies, native media roles and generic
overrides. No new generation requests were made for saved-response parsing or
parked-job recovery.

Validation: the full 4,227-test website unit suite passed, followed by focused
report tests including an additional late-collection persistence regression.
Four Chromium SVG security/lifecycle tests, website and root typechecks, lint, formatting,
unused-code checks, and ADR validation. The separate ElevenLabs backend
regression fails before its patch and passes afterward.
