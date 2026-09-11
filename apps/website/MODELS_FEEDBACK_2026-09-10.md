# Models preview feedback — September 10

Eric's hero, card, duplicate-variant and media-input feedback is implemented in
the Models integration code. This report describes checked code, not a claim
that every provider has completed a paid generation.

| Feedback                                 | Change / evidence                                                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing Seedance 2.0 and FLUX.3 hero art | Their content assets are videos; the hero now uses video elements. Both decode real frames in Playwright.                                                                                           |
| Smaller hero and cards                   | Mar's compact-height treatment: 306px measured hero including border on a 1366×768 viewport; row cards 232px instead of 288px. Mobile checked at 390×844 with no horizontal overflow.               |
| Standard parameters                      | Every visible resolution/aspect-ratio control is a dropdown. Only native-valid values are offered; defaults/presets are validated against the selected form.                                        |
| Duplicate Seedance Lite cards            | The three modes now retain their distinct First-Last Frame, Image Reference and Image-to-Video names and controls. Related cards exclude the current Router model and deduplicate other Router IDs. |
| Missing image/video inputs               | Per-use-case creator variants preserve required source media and native request paths. URL/file uploads, image previews and video/audio players are available where the native API accepts them.    |
| Missing example inputs/defaults          | Rob's values are restored through field/role mapping and schema validation. Grok's source image and settings load; Veo's two frames load and compose into its native Base64 request.                |

## Content and availability limits

- Rob's three Seedance 1.0 Lite Animate images records contain no worked
  examples or output samples. They need editorial content, not guessed media.
- Kling V3's Animate images record and Wan Reference Video's Animate images
  record are withheld because the verified native targets do not support those
  input modes. Their supported use-case pages remain. Source data is preserved.
- Kling Video Extend requires an existing generation `video_id`, not a generic
  file upload. Its minimal required control remains explicit.
- At frontend commit `0d965bab7b9`, with Router source
  `9064b7d8748b2e5833be9a102f3ca36185137d86`, publication contained 155
  use-case pages for 113 Router models and zero Incomplete pages. All 288 packed
  content/use-case records and 206 generated authored contracts were retained.

## Verification and handoff

Focused regression tests cover native media composition, URL uploads, Base64
example downloads, distinct modes, invalid defaults, related-card identity,
required media, dropdowns, hero playback and media controls. Installed Playwright
checks real local pages and CDN assets on desktop/mobile with generation POSTs
blocked. The enabled Astro build succeeds with 1,999 HTML outputs, including
legacy routes. No paid generation or purchase was made.

CI follow-up: eight older test files still assumed native-only URLs, visible
MiniMax without input schemas, one creator form per Router, ribbons per card
rather than Router identity, or file cards instead of media players. The Hub
provider test also clicked an undefined element when Kling fell outside the
first six chips. Tests now exercise the intended publication policy, selected
use-case contract, media controls and expanded provider list. All 788 tests in
those files pass, in addition to the 1,006 feedback tests. The 720-test contract
file also passes with V8 coverage; the bulk deterministic generation test has a
15-second budget because coverage on CI exceeded its former five seconds.

The feedback application code deployed successfully in preview run
[34538672423](https://github.com/Comfy-Org/ComfyUI_frontend/actions/runs/34538672423)
at `daf7c8dc4b`. Live Playwright checks confirm the hero media, source-image
prefills, native API composition and upload controls with no application errors.
The subsequent test-only follow-up does not change that application code.

Real merge work belongs to #17382 (`ben/models-integration`); #17263 remains a
disposable `workshop`-labeled preview. Maanil's auth PR #17283 merged as
`6f22e4bbbefb41f331aee90163933b9b0b82db74`; this pass does not modify the account
package. Release-boundary/prototype-cleanup work in `MODELS_INTEGRATION_PLAN.md`
still prevents treating the integration as production-ready.

## Follow-up: example media must occupy the upload slots on first open

The earlier browser pass checked that video upload controls existed, not that
their source examples were populated. That was insufficient. This pass fixes:

- URL examples now occupy the upload slot, with replace/remove controls, instead
  of rendering beside an apparently empty drop zone. Video previews load a frame
  without needing a Play click. URL-native requests remain URLs until replaced.
- Example projection preserves ordered image arrays, typed media roles and
  numbered reference fields. Native Base64 bindings download and validate actual
  example bytes only when composing a request, retaining size/cancellation checks.
- Wan 2.7/3.0 reference examples retain their second image in both the UI and
  native `input.media` array. Luma Photon/Uni image references now have widgets
  and map to the native image-reference/source objects; Edit pages require one.
- Bria image upscale/background-removal values now populate image upload slots;
  retaining those URLs only in plain text fields was not sufficient either.
- Four empty video example prefills were recovered from their actual workflow
  sources and saved in the packed content file. Output samples were not reused
  as inputs, and withheld cross-use-case content remains withheld.

Source workflow revision: `Comfy-Org/workflow_templates` at
`f331af10934fdf0d773d5f26c1d00f33559ae09d`, under `templates/`:

| Workflow                                   | Verified source inputs                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `api_bria_video_green_screen.json`         | `input/investigator.mp4`                                                     |
| `api_bria_video_replace_background.json`   | `input/stained_window_vintage_woman.mp4`, `input/gothic_hall_light_rays.png` |
| `api_runway_aleph2_video_edit.json`        | `input/sunset_city_skateboarder.mp4`; connected edit prompt preserved        |
| `api_wavespeed_flshvsr_video_upscale.json` | `input/lighter.mp4`                                                          |

All five input asset URLs return 200 with the correct image/video MIME types.
The full published-example audit covers 42 media-bearing examples and 52 source
asset occurrences: none are discarded by form projection. The permanent
`workshop-example-values.test.ts` checks every supplied media URL reaches a media
widget, not merely any string in the form.

Focused verification: 1,333 tests across 10 affected files pass. Initial-load
browser checks verify decoded frames/images inside the upload groups, with
generation POSTs blocked. No account/auth implementation is changed.

Do not interpret this as invented content for empty records: pages without
authored example inputs still need content. Optional last/reference slots stay
empty when that specific example has no corresponding input.

CI at the preceding integration head `4c9fdeb9b5` passed website units but failed
23 website E2E/visual checks (438 passed). The route/form failures and
site screenshot differences remain a separate integration follow-up; this media
fix does not waive them or claim the entire PR is merge-ready.

## Follow-up: upload-only media controls

Media fields no longer render an editable URL textbox or textarea. Image,
video, audio, mixed-media and other file inputs use the existing upload control;
ordinary text fields remain editable. Internal example URLs still populate the
preview slots on first open and remain unchanged until replaced or removed.
URL-native models upload selected files to obtain a URL; Base64-native models
retain their existing encoding path. No catalog or content data was removed.

Verification: 160 focused tests across eight files, website typecheck, changed-file
lint and the enabled build pass. Browser checks cover 17 example pages on desktop
and mobile with no media URL editors, decoded previews, and file selection,
replacement and removal for URL-image, URL-video and multiple-Base64-image forms.
Generation POSTs were blocked; no paid generation was made.
