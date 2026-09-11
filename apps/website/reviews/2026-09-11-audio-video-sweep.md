# Audio and video model verification — September 11, 2026

The production campaign tests all 72 published audio/video pages using the exact
initial page inputs through `router_render(slug, {})`. Two unchanged passes were
preserved after comparing their input hashes: Seed Audio 1.0 and Luma Ray 2
image-to-video. The other 70 pages were selected for a sweep with 32 workers and
at most two starts per second, using the account's confirmed concurrency limit
of 200. One page failed preflight; 69 generation requests were dispatched.

Final production results across all published pages:

| Modality | Pages | Passed | Live failure | Preflight failure | Unsupported |
| -------- | ----: | -----: | -----------: | ----------------: | ----------: |
| Image    |    75 |     61 |           14 |                 0 |           0 |
| Video    |    67 |     52 |           14 |                 1 |           0 |
| Audio    |     5 |      4 |            1 |                 0 |           0 |
| 3D       |     7 |      0 |            0 |                 0 |           7 |

All 146 runnable media pages have production generation evidence. The 147th
media page is the Kling extension preflight failure. The audio/video recovery
campaign finished with 54 passes and 15 failures; the two preserved passes bring
that group's total to 56. The corrected Veo animation retest supersedes its
prompt-only result. There are no remaining production account-capacity blocks.

The [complete results grid](../MODELS_TEST_RESULTS.md) records each outcome,
request ID, revision and decoded artifact evidence. Account blocks, preflight
failures, provider errors and unusable output remain distinct. Successful output
means the returned media was downloaded and decoded, not merely that Router
accepted a request.

## Confirmed page and mapping fixes

Veo 3 Animate Images originally sent exactly the same prompt-only request as its
text-to-video page. Its video generation passed, but that did not verify the
advertised animation task. The shared defaults now supply a first frame through
the standard parameter mapping and existing Base64 adapter. A regression test
checks the encoded image in the animation request and its absence in the
text-only request. The corrected page passed a separate live generation with an
actual encoded source image and decoded video output.

BFL continuation also inherited the 20-second duration ceiling used by text/image
generation. Its fixed continuation variant now accepts `auto` or 5–15 seconds,
as specified by the provider. Generic `duration_seconds: 20` maps to 15 for
continuation and remains 20 for the other two modes; explicit unsupported native
values fail validation. This change does not explain or resolve the initial
continuation failure, which used `auto`.

## Failures needing investigation

Kling video extension has no initial `video_id`. It needs an actual prior Kling
generation ID; a video URL cannot replace that field. No prerequisite generation
is silently created, and this page remains a preflight failure.

ElevenLabs Sound Effects returned `400 invalid_input` again, request
`69add6e0-b0d2-4773-926b-7aa4c79910bc`. Its page inputs contain valid text,
five-second duration and prompt influence. The pinned Router injects
`model_id: eleven_sfx_v2`, while the provider's
[official SDK enum](https://raw.githubusercontent.com/elevenlabs/elevenlabs-python/main/src/elevenlabs/types/sfx_model_id.py)
uses `eleven_text_to_sound_v2`. Router forwards its injected value unchanged.
This is a backend mapping discrepancy and a likely explanation for the failure;
upstream logs are needed to confirm the exact rejection. Frontend input changes
cannot repair an identity that Router injects or enforces.

BFL FLUX 3 continuation and both Gemini video-edit variants rejected their
initial requests with `400 invalid_input`. The shared source clip was fetched and
fully decoded: H.264 High/yuv420p MP4, 768×432, 24 fps, exactly 10 seconds,
424,848 bytes, no audio. The public URL returns the correct MIME and permits
cross-origin access. The BFL default request matches its published continuation
schema. Gemini's documented editing limit permits a ten-second input; its MIME
field is optional and external HTTPS input is documented. The available evidence
does not prove that duration, missing MIME or public URL caused these failures.

Backend request IDs for those three failures:

- BFL continuation: `7af603cc-be35-4cfb-84a2-88236d56d2ee`
- Gemini Omni 1.1 edit: `295e9c62-c647-4a0e-8ce9-4ac3accc20d4`
- Gemini Omni preview edit: `8cd43b8d-296a-4bd5-a632-6c7e18a5e8e1`

Provider references: [BFL OpenAPI](https://api.bfl.ai/openapi.json),
[Gemini Omni limits](https://ai.google.dev/gemini-api/docs/omni#limitations),
[Gemini file inputs](https://ai.google.dev/gemini-api/docs/file-input-methods),
[Interactions API](https://ai.google.dev/api/interactions-api).

Other provider/input failures and timeouts are listed individually in the grid.
Router's normalized errors often omit upstream detail; these results identify
which pages need attention without inventing a cause. Accepted provider jobs
may finish after a local timeout. No failed generation was automatically retried.

Validation: 295 focused rendering, generic mapping and content tests passed after
the Veo/BFL fixes. Website typecheck, lint, formatting and unused-code checks
passed. The preceding image changes passed the full website suite (4,187 tests).
The live campaign used the shared page request builder, temporary upload path,
Router client and output parser, followed by full media decoding.
