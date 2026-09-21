# Shared Router rendering and model smoke tests

For setup, account concurrency overrides and image-first test commands, see
[Run the model-page generation tests](MODEL_TESTING.md).

`src/config/router-render.ts` is the browser-safe execution boundary. The model
page's Run button and `scripts/router-render.ts` use it. The script wrapper reads
`COMFY_KEY`; browser callers pass a credential or an async credential getter.

The public `router_render` / `router_for_model` / `router_get_*` names follow the
requested shared API contract. Internal TypeScript helpers use camelCase.

```ts
import { router_for_model, router_render } from './scripts/router-render'

const model = router_for_model('bfl--flux-2-pro--generate-images')
model.router_get_closest_value('1100x760', 'size')
model.router_get_default_value('prompt')

const result = await router_render('bfl--flux-2-pro--generate-images', {
  prompt: 'A blue ceramic fox on a wooden table',
  size: '1100x760',
  seed: 42,
  quality: 0.8,
  model_specific: { prompt_upsampling: false }
})
```

The model context is bound once for the two argument helpers. Browser consumers
can bind `createRouterParameters(schema, defaults, mappings)` directly without
loading the whole catalogue. `router_render(slug, {})` uses the exact first-render
page state, including its first runnable example and shared media defaults.

## Standard inputs

| Parameter                                                 | Standard value                                     | Mapping                                                                      |
| --------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `prompt`, `negative_prompt`                               | Text                                               | Supported prompt fields; native length validation remains authoritative      |
| `seed`                                                    | Finite integer                                     | Closest valid native integer/range                                           |
| `size`                                                    | Positive `WIDTHxHEIGHT` pixels or `{width,height}` | Closest native size, width/height grid, or ratio/resolution                  |
| `aspect_ratio`                                            | Positive `WIDTH:HEIGHT`                            | Closest supported ratio                                                      |
| `resolution`                                              | Pixels, `720p`, `1080p`, `2k`, etc.                | Closest native resolution                                                    |
| `duration_seconds`                                        | Seconds                                            | Closest allowed duration/range                                               |
| `quality`                                                 | Number from 0 to 1, or supported label             | Native numeric scale or ordered quality choices                              |
| `guidance`, `steps`                                       | Finite values in guidance units / iteration counts | Native range and increment                                                   |
| `output_format`, `style`                                  | Supported label                                    | Exact categorical match; unknown categories fail                             |
| `generate_audio`                                          | Boolean                                            | Supported audio-generation setting                                           |
| `source_images`, `source_videos`, `source_audio`          | Arrays of media                                    | Source controls                                                              |
| `reference_images`, `reference_videos`, `reference_audio` | Arrays of media                                    | Reference controls; shared image-list controls accept sources and references |
| `first_frame`, `last_frame`, `mask_image`                 | One media value                                    | Dedicated role                                                               |

Media can be an HTTP(S) URL, a Base64 data URI, a `Blob`/`File`, or
`{data: Uint8Array | ArrayBuffer, mimeType, name?}`. Raw Base64 without a MIME
prefix is only appropriate inside a model-specific native string field.
URL endpoints upload binary data through `/customers/storage` and the returned
signed PUT URL. Base64 endpoints download supplied URLs and encode their bytes.
Neither media downloads nor signed uploads receive the Comfy authorization token.

Precedence is page defaults, supported standard overrides, then strict
`model_specific` form-field overrides. Unsupported known standard parameters are
omitted. Unknown parameter names, invalid categorical choices, and invalid native
overrides fail before generation. Clearing a required field also fails. Some
native limits constrain combinations of parameters; the complete compiled request
still goes through native schema validation.

The standard contract is shared across model families. For example, the same
`duration_seconds: 8.2` becomes Luma's `"9s"`, Kling's `"8"`, or Seedance's `8`;
`quality: 0.8` selects the nearest supported quality level. `resolution` also
reaches native fields called `size` or `imageSize`. When a model uses separate
width and height controls, derived dimensions fit within its limits together
to preserve the requested aspect ratio.

Source and reference images share one ordered list when the model uses a single
image pool, including indexed controls. Models with separate source/reference
roles retain that separation. Explicit first/last frames take precedence over
fallback images; keyframe callbacks carry those roles. Lists are limited to the
model's input capacity. The closest-value helpers use these same mappings.

`scripts/router-standard-inputs.test.ts` compiles the same standard JSON through
multiple model families and checks their native requests, including binary media
and upload conversion. These tests exercise mappings without paid generation.

## Extending support

1. Keep the existing input/JSON template and Router contract. Ordinary templates
   still use the existing typed replacement compiler or registered callback.
2. Bind native field names to standard parameters in `router-parameters.ts`, or
   supply `RouterParameterMappings`. An enum with provider-specific labels can
   declare standard comparison values, e.g.
   `{rendering_speed: {parameter: 'quality', options: {TURBO: 0, QUALITY: 1}}}`.
3. Put endpoint exceptions in `scripts/router-model-adapters.ts`. It currently adds
   Base64 image/mask bindings and a text lip-sync template. The contract generator applies
   these adapters before constructing the page. Run `pnpm --filter @comfyorg/website
generate:workshop-router-contracts` after changing them.
4. Put authored starter inputs in `router-default-inputs.ts`. They become visible
   page defaults, not private test overrides. Preserve valid authored examples.
5. Run the model with `{}` and inspect the decoded artifact. Never mark a schema
   preflight or returned URL as a generation pass.

SVG outputs use the same browser renderer in the page and CLI. The page previews
the resulting PNG and offers the original SVG as an inert download. The CLI
starts one Playwright Chromium browser when needed, with at most four rendering
pages. SVG documents are limited to 4 MiB and 16 megapixels, with cancellation
and a ten-second processing limit. Scripts and external document resources do
not execute in the image renderer. SVG never enters the page DOM: an SVG
document can carry active content, so inline SVG and iframe previews are not
used.

No component should grow a provider-specific execution branch. A model needing a
previous provider job ID (currently Kling video extension) still needs an explicit
prerequisite adapter; the defaults never invent that ID or silently run a second
paid generation.

## Parallel live test rig

```sh
pnpm --filter @comfyorg/website test:router-models

# Set COMFY_KEY in the environment, not as a command-line argument.
PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:router-models \
  --execute --concurrency 16 --starts-per-second 2

PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:router-models \
  --execute --concurrency 1 --slug bfl--flux-2-pro--generate-images

PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:router-models \
  --execute --modality image --concurrency 1 --starts-per-second 0.1
```

Requires `ffprobe` and `ffmpeg` for live execution. `--help` lists time, artifact
size, output directory and selection options. Dry preflight makes no network
calls and exits nonzero for invalid defaults. The live sweep inventories every
published image/video/audio page, including separate use-case pages for the same
Router identity. The results grid also lists published 3D and text pages as
untested; their output formats are outside this acceptance test.

Each run creates a new private directory under `temp/router-model-tests/` with:

- `manifest.json`: selected pages, origin, concurrency and limits.
- `events.jsonl`: preflight, prepared request, response ID and final evidence.
- `<slug>/outputs.json`: every parsed output, saved before media verification,
  including URLs that the page could not classify.
- `<slug>/response-N.json` or `.txt`: complete local response attachments,
  saved before their blobs are released. JSON with extracted inline media is
  the parser's metadata document; other JSON attachments can be replayed through
  the parser without another generation.
- Per-model `request.json` and downloaded media with byte counts, SHA-256,
  dimensions or duration. FFmpeg decodes the media, detecting broken content.
- `summary.json`: passed, failed, cancelled and preflight counts.

The tester also maintains [MODELS_TEST_RESULTS.md](MODELS_TEST_RESULTS.md) and
`testing/models-test-results.json`. Commit both generated files. The Markdown
puts cases needing attention above the complete grid; the JSON retains the latest
input preflight, latest live result and last successful generation per page,
environment and input mode. Dates and revisions distinguish older evidence from
new validation. Partial or dry runs preserve live results for other cases.

Only downloaded and decoded media counts as a pass. Account limits and missing
credits are recorded as blocked checks, so they do not label a model broken.
Use failed defaults or live failures to investigate and decide which catalogue
entries to disable. Changing availability remains an explicit catalogue edit;
the tester does not hide models automatically. The public files contain safe
failure codes, request IDs and artifact metadata; prompts, credentials, signed
URLs and raw responses remain in the private evidence directory.

Use `--report path/results.md` for a separate campaign ledger; its state is
`path/results.json`. One tester process owns a report at a time, while its model
workers run in parallel. A second process fails before paid requests rather than
overwriting the first process's evidence. After an abrupt process termination,
remove a leftover `.json.lock` only after confirming its tester has stopped.

The runner never automatically retries a generation, including HTTP 429. Each
case gets one idempotency key, recorded before dispatch. Responses include bounded
failure details and concurrency headers when available. Request bodies and media
may contain private input or signed URLs; the output directory is intentionally
local, access restricted, and not checked into Git. Blob outputs are released
after verification. Ctrl-C stops pending work and cancels local requests; an
accepted provider job may still finish remotely.

`--modality` selects all published pages of one media type. Fractional
`--starts-per-second` values allow slower pacing: `0.1` starts at most one case
every ten seconds. Captured outputs and response attachments use private `0600`
files, redact the API key if echoed by a provider, and never count as a media
verification pass on their own.

During live execution, the Node tester sets Undici's header and body inactivity
timeouts to `--timeout-seconds`, then restores the previous dispatcher and closes
its connections. This avoids Node's default five-minute header timeout cutting
off a paid generation early. The per-case abort deadline and the shared Router
client's 660-second per-request limit still apply. All retries and waits share
a 2,700-second total deadline, on both the website and the Node client.

When Router's own deadline passes it answers HTTP 504 `deadline_exceeded` and
parks a submitted generation. `runWorkshopRouter` then repeats the identical
request with the same idempotency key, at most three times, and Router returns
the original generation rather than starting a new one. Pages and the tester
share this behaviour; `router_render` reports it as `deadlineCollections`.
See [Node's custom dispatcher API](https://nodejs.org/api/globals.html#custom-dispatcher)
and [Undici's timeout options](https://undici.nodejs.org/api/Client).

The API account also imposes a shared Partner Node concurrency limit. A high local
worker count does not increase that entitlement. Choose `--concurrency` within
the account's available slots, or raise its limit before a highly parallel sweep.
A `concurrency_limit_exceeded` result means the model was not tested. See
[the admin override instructions](MODEL_TESTING.md#give-your-account-maximum-concurrency)
and
[Comfy's concurrency documentation](https://docs.comfy.org/tutorials/partner-nodes/concurrency-limits).
