# Backend follow-up from the model-page tests

The September 11 production sweep found several distinct failure causes. Current results and fixes are summarized in the
[remediation report](2026-09-11-model-failure-remediation.md). Keep a page failed
in [the results grid](../MODELS_TEST_RESULTS.md) until its actual page-default
Router response yields a decoded artifact. A local patch, a
provider-side diagnostic call, or a replacement model is not a successful page
test.

Backend source inspected: `Comfy-Org/cloud` commit
`9064b7d8748b2e5833be9a102f3ca36185137d86`. This is the frontend's pinned contract
revision. Production logs identify version `1437155`, which resolves to cloud
commit `143715523294894d69057c5d8b150e594708d18d`. Its idempotency, run handler,
and async billing files match the inspected pin. The shared cloud checkout
was not modified, and no backend change was deployed.

## Confirmed ElevenLabs model-ID defect

`elevenlabs--sound-effects--audio` fails through Router with HTTP 400. Replaying
the same native inputs through the public sound-generation proxy exposes the
provider's HTTP 422: its `model_id` enum accepts `eleven_text_to_sound_v2` and
`eleven_text_to_sound_v3`, but Comfy forwards `eleven_sfx_v2`. The
[ElevenLabs API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
also names `eleven_text_to_sound_v2` as the default.

The fix belongs after the allowlist check in
[`soundGenerationProxy`](https://github.com/Comfy-Org/cloud/blob/9064b7d8748b2e5833be9a102f3ca36185137d86/services/comfy-api/server/middleware/elevenlabs.go#L262):
retain `eleven_sfx_v2` as the public Router ID and metered pricing key, and
translate only the outbound provider body to `eleven_text_to_sound_v2`.
Changing the frontend model field or applying a Router override before this
middleware would fail its public-ID allowlist.

A reviewable [backend patch and regression tests](patches/elevenlabs-sound-model-alias.patch) are included with this report. It preserves unknown
JSON fields without changing numeric precision, updates body length/replay
metadata, and leaves other model IDs rejected. Tests exercise the real Rewrite
for both Router and direct-proxy requests, including omitted/null/explicit IDs.
The new regression fails against the original pinned file; the focused
ElevenLabs and Router ElevenLabs tests pass with the patch:

```sh
cd services/comfy-api
GOWORK=off go test ./server/middleware -run 'Test(ElevenLabs|RouterElevenLabs)' -count=1
```

Validation used an isolated archive and Go 1.27.0. Production generation remains
unverified until the backend fix is deployed and the page test is rerun.

## Retired BytePlus versions

BytePlus's [deprecation notice](https://docs.byteplus.com/en/docs/ModelArk/1350667)
lists the `250428` Seedance 1.0 Lite I2V/T2V versions and the `250415` Seedream 3
version with a May 13, 2026 deactivation date. All five corresponding pages
returned provider errors. Withdraw these old versions or introduce explicitly
named and tested replacement pages; another retry cannot restore the advertised
retired version. The notice's automatic endpoint migration also means a success
alone would not prove an old endpoint still runs the named version.

## Wan 3 rejects the supplied URLs

All three Wan 3 tasks were accepted, then immediately reported `FAILED` with
`InvalidParameter`: `media.url must not contain '@'`. This is confirmed for all
three page requests in [the terminal task logs](https://us5.datadoghq.com/logs?from_ts=1789108200000&live=false&query=env%3Aprod-v2+service%3Acomfy-api+%28%2A%3A%2225858283-5a7c-4b6a-b723-3cb58c51b7ae%22+OR+%2A%3A%22d27d40af-12b7-42ff-bcdb-0d72e9ae2bde%22+OR+%2A%3A%2210260200-dc3b-42b0-ad62-f8366946cb7e%22%29+%22Task+failed+with+error%22&stream_sort=asc&to_ts=1789115400000).

The earlier hostname hypothesis is superseded: submission and polling reached
`dashscope-intl.aliyuncs.com` successfully. The shared page input adapter now rehosts those sources through Comfy temporary
storage. All three actual page-default retests passed with decoded videos. Changing
backend hosts is not supported by these failure records.

## Seedance Mini and Photon failures

Seedance 2 Mini submitted successfully and resolved to
`dreamina-seedance-2-0-mini-260615`. It failed with
`OutputAudioSensitiveContentDetected.PolicyViolation`; the provider says the
**generated audio** may relate to copyright restrictions.
[Task evidence](https://us5.datadoghq.com/logs?from_ts=1789108200000&live=false&query=env%3Aprod-v2+service%3Acomfy-api+%2A%3A%22cgt-20260911154021-wcsqr%22+%22Task+failed+with+error%22&stream_sort=asc&to_ts=1789115400000). The saved default prompt describes an original sci-fi
fleet scene and names no music or artist; `generate_audio` is true. This is a
failed generation, not evidence of a retired endpoint or an intentionally
copyrighted prompt. Preserve the provider restriction and report its actual
reason. Any change to the visible default's audio behavior must be explicit.

Both Photon 1 tasks submitted successfully and ended with `state: failed`,
`failure_reason: Job failed`, and no assets. The provider gives no narrower
cause in [the captured terminal responses](https://us5.datadoghq.com/logs?from_ts=1789108200000&live=false&query=env%3Aprod-v2+service%3Acomfy-api+%28%2A%3A%22592cdf10-a0e0-46ce-8584-dc28c49495ed%22+OR+%2A%3A%223b39ba40-68b3-4dd9-8e80-c9f1ec5efe90%22%29+%22Task+failed+with+error%22&stream_sort=asc&to_ts=1789115400000). These were upstream job failures. A single controlled retest of both Photon 1
pages and Seedance Mini passed with unchanged page defaults; their new decoded
artifacts are recorded in the grid. No provider policy was bypassed and audio
remained enabled for Mini.

Kling text lip-sync failed because its synthesized default speech was shorter
than two seconds. The voice/language mapping was valid. A longer visible default
sentence passed the actual page generation and video decoder.

## Three timeouts completed and were billed

The two Photon Flash calls and WaveSpeed Ultimate call returned Router HTTP
504 after about 541–549 seconds. Their existing tasks subsequently completed
successfully, and Cloud usage tracking succeeded:

| Page                    | Provider task                          | Completion and billing recorded (UTC) |
| ----------------------- | -------------------------------------- | ------------------------------------- |
| Photon Flash generation | `3cb42906-9c51-45ff-ae61-a41bb8b6c93c` | 2026-09-11 07:39:24                   |
| Photon Flash edit       | `3d19be7c-ec15-4eaa-8b3d-b25dbe59f46c` | 2026-09-11 07:39:27                   |
| WaveSpeed Ultimate      | `7953b02ead4f40858e498f0a82bfd2cb`     | 2026-09-11 07:57:47                   |

[Completion and usage evidence](https://us5.datadoghq.com/logs?from_ts=1789108200000&live=false&query=env%3Aprod-v2+service%3Acomfy-api+%28%2A%3A%22a3a926fd-ea55-4eef-b180-db88d075c8b7%22+OR+%2A%3A%221f74f13d-8b67-4077-9af3-428a63acc081%22+OR+%2A%3A%22c2486806-add6-4233-8cd4-83c4583cc0de%22%29+%28%22Async+task+completed+successfully%22+OR+%22Successfully+tracked+usage%22%29&stream_sort=asc&to_ts=1789115400000). Success output bodies and URLs
were not present in the targeted logs; logs alone did not establish artifact validity. Subsequent collection of all
three parked jobs through the shared Router client returned the original provider
task IDs and passed media decoding. The corrected Seedance 2.5 first/last-frame
job also exceeded the deadline and passed after collection. Production logs
confirmed adoption and collection rather than a replacement generation for all
four recoveries. These passes require a second collection request after the
initial HTTP 504; the ordinary page call did not finish within that first request.

All three have [confirmed successful idempotency park records](https://us5.datadoghq.com/logs?from_ts=1789108200000&live=false&query=env%3Aprod-v2+service%3Acomfy-api+%28%2A%3A%229cf4fce0-d502-4320-928f-a25b167ebac1%22+OR+%2A%3A%228f43b483-b841-4a8b-87b5-9d4d22137a58%22+OR+%2A%3A%22623197d7-bedd-462d-a95a-70ce11e3452d%22%29+%22parked+an+uncollected%22&stream_sort=asc&to_ts=1789115400000) with
reason `deadline_exceeded`. The generic 504 response says retries dispatch
anew, but that prose is inaccurate for these parked async jobs. The deployed
[adoption path](https://github.com/Comfy-Org/cloud/blob/143715523294894d69057c5d8b150e594708d18d/services/comfy-api/server/middleware/router_idempotency.go#L914)
and [run handler](https://github.com/Comfy-Org/cloud/blob/143715523294894d69057c5d8b150e594708d18d/services/comfy-api/server/implementation/router_run.go#L2257)
collect the saved handle before the submission branch.

Recovery must use the original authenticated scope, idempotency key, POST
path/query and compact request bytes. The saved `request.json` is pretty
printed; parse it and use the same `serializeRouterInput` function to reproduce
the wire body. Do not prepare the inputs again or upload new media. The park's
24-hour lifetime starts with the original reservation on September 11 and
expires approximately September 12 at 07:27 UTC for these jobs; recovery after
expiry can submit a new job.
Verified original keys, body paths and hashes are kept privately in
`temp/backend-fixes/recoverable-timeout-jobs.json`. Increasing only the tester timeout cannot fix the
original server-side deadline; the page needs the supported collection flow.

| Page                               | Observed result               | Next action / diagnosis                                 | Request ID                             |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------- | -------------------------------------- |
| ElevenLabs Sound Effects           | 400; direct proxy reveals 422 | Apply and deploy alias translation, then rerun          | `69add6e0-b0d2-4773-926b-7aa4c79910bc` |
| Seedance 1.0 Lite first/last frame | 502                           | Retired version                                         | `8d5f5e78-963a-4401-b387-dfcac6d10347` |
| Seedance 1.0 Lite image reference  | 502                           | Retired version                                         | `0ff606d6-3e55-4caa-81f8-7b42f1645993` |
| Seedance 1.0 Lite image to video   | 502                           | Retired version                                         | `fe82b975-aafd-4588-ac20-4d1c7fde56b8` |
| Seedance 1.0 Lite text to video    | 502                           | Retired version                                         | `90cc5e59-5b94-4618-9b2a-4abe0c051a92` |
| Seedream 3                         | 502                           | Retired version                                         | `748e04bc-8695-4f2d-8923-9990752bbd12` |
| Wan 3 image to video               | 502                           | Rejected @; temporary-upload retest passed              | `6be58d83-766c-4fc6-b926-86d04bf8e1be` |
| Wan 3 reference to video           | 502                           | Rejected @; temporary-upload retest passed              | `a43be7ad-a814-491a-aa53-5fab076a264d` |
| Wan 3 Prime reference to video     | 502                           | Rejected @; temporary-upload retest passed              | `0030b4f5-5fcc-4e81-a2c5-32df4d31d7bc` |
| Seedance 2 Mini text to video      | 502                           | Audio policy rejection; unchanged-default retest passed | `7c09482f-d734-4a9c-9f86-d98d3784327f` |
| Kling text lip-sync                | 502                           | Speech under two seconds; longer default passed         | `683f8b3b-284d-4609-a11b-68ac400e70d6` |
| Luma Photon 1 generation           | 502                           | Job failed; unchanged-default retest passed             | `a96e5fb8-9e0b-4b68-9080-b0910d1db6d1` |
| Luma Photon 1 edit                 | 502                           | Job failed; unchanged-default retest passed             | `424c7626-3102-4309-9ee3-ec1688395c0b` |
| Luma Photon Flash generation       | 504                           | Parked task collected; decoded artifact passed          | `9cf4fce0-d502-4320-928f-a25b167ebac1` |
| Luma Photon Flash edit             | 504                           | Parked task collected; decoded artifact passed          | `8f43b483-b841-4a8b-87b5-9d4d22137a58` |
| WaveSpeed Ultimate upscaler        | 504                           | Parked task collected; decoded artifact passed          | `623197d7-bedd-462d-a95a-70ce11e3452d` |

Production log lookup should use these request IDs around 2026-09-11
07:27–07:58 UTC. Record the resolved provider model, upstream status/error code,
task ID/state, terminal result and billing outcome. No credentials or private
input/output URLs belong in this note or the public grid.

## BFL continuation rejects both media transports

The continuation task returns provider HTTP 422, `Invalid or corrupted image
input`, with both the default source-video URL and the same MP4 encoded inline.
The Base64 experiment's Router request was
`c7600359-0454-4c9d-b159-341935e6616a`; its terminal task was `error`.
[BFL's OpenAPI schema](https://api.bfl.ai/openapi.json) explicitly permits
HTTP(S) URLs or Base64 MP4 for `Flux3VideoV2VInputs.start_video`.

Changing the transport did not fix generation, so the experimental file control
and Base64 callback were removed. The page retains its URL adapter and remains
failed. The earlier 5–15 second continuation-duration correction is retained;
there is still no demonstrated fix for this provider rejection.
