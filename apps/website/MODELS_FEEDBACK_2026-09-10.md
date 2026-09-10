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
- Current publication: 155 use-case pages, 113 Router models, zero Incomplete
  pages; 288 source records and 206 authored contracts retained. Generated
  contracts remain packed and reproduce byte-for-byte.

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
