# Run the model-page generation tests

The tester calls `router_render(slug, {})` with the same initial inputs,
parameter mappings, media conversion, temporary uploads, Router client and
response parser as the model pages. A pass requires downloading and decoding
an image, video or audio file. The [results grid](MODELS_TEST_RESULTS.md) lists
every published page, its latest result and its last successful generation.

## Setup

Run commands from the repository root. Use the Node and pnpm versions specified
by the root `package.json` (currently Node 26.8.2 or newer within 26.x, and
pnpm 11.13.1).

```sh
pnpm install --frozen-lockfile
```

Live runs require `ffmpeg` and `ffprobe` on `PATH`. On macOS, `brew install ffmpeg`
provides both. You need a Comfy API key with credits in the environment being
tested. The tester runs locally against hosted Router; provider secrets and a
local Router deployment are not needed.

Vector image outputs also require Playwright Chromium. The tester uses it to
run the page's SVG-to-PNG renderer before checking the image:

```sh
pnpm --filter @comfyorg/website exec playwright install chromium
```

Load the key into the exported `COMFY_KEY` variable through your secret manager
or shell profile. To enter it without displaying it or putting its value into
shell history, use this in zsh (the macOS default shell):

```zsh
read -rs 'COMFY_KEY?Comfy API key: '
printf '\n'
export COMFY_KEY
```

In Bash, replace the `read` line with `read -rsp 'Comfy API key: ' COMFY_KEY`.
Use lowercase `export`; the tester reads the process environment and does not
load `.env` files or shell profiles itself. Keep the key out of committed files.

Select the backend explicitly, including for dry runs:

```sh
export PUBLIC_WORKSHOP_CLOUD_ENV=prod
```

Other valid values are `staging` and `test`; the key must belong to that
environment. An unset value defaults to staging for dry runs. Live execution
requires an explicit valid environment.

## Give your account maximum concurrency

These steps require Comfy admin access. Change the customer account that owns
`COMFY_KEY`, which may differ from the account you use to sign into admin.

1. Open [Comfy Admin → Users](https://admin.engcomfy.com/users).
2. Select **prod**, matching the tester's environment.
3. Search by the key owner's email or Firebase UID and open the matching user.
4. Find **Partner-node concurrency**.
5. Enter **200** in **Set override** and click **Save**. This is the maximum
   finite override and was used for the September 11, 2026 sweep.
6. Check that **Effective limit** shows **200 concurrent** with reason
   **manual_override**.

| Admin value | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `200`       | Maximum finite account limit                                         |
| `-1`        | Unlimited account concurrency                                        |
| `1`–`199`   | Smaller fixed account limit                                          |
| `0`         | Block Partner Node calls                                             |
| **Clear**   | Remove the override and restore the spend-based limit shown in admin |

For an unlimited account setting, enter **-1** instead of 200. The override
persists until changed or cleared. If the panel says **Not configured for this
environment**, the admin service needs its backend configuration completed;
the tester's API key cannot set the admin override.

Verify the effective limit using the exact key the tester will use. This
read-only request prints the limit and reason, never the key:

```sh
python3 - <<'PY'
import json
import os
import urllib.request

origins = {
    'prod': 'https://api.comfy.org',
    'staging': 'https://stagingapi.comfy.org',
    'test': 'https://testapi.comfy.org',
}
request = urllib.request.Request(
    origins[os.environ['PUBLIC_WORKSHOP_CLOUD_ENV']]
    + '/customers/me/partner-node-concurrency',
    headers={'Authorization': 'Bearer ' + os.environ['COMFY_KEY']},
)
with urllib.request.urlopen(request, timeout=30) as response:
    result = json.load(response)
print(json.dumps({name: result[name] for name in ('limit', 'reason')}))
PY
```

Expected after setting 200: `{"limit": 200, "reason": "manual_override"}`.
Unlimited reports `limit: -1`. If the value differs, check the environment,
selected customer and API-key owner.

The account limit is shared with its other Partner Node calls. Cloud workflow
job limits are separate. Credits, provider restrictions and other rate/spend
limits still apply; see [Comfy's concurrency documentation](https://docs.comfy.org/tutorials/partner-nodes/concurrency-limits).

## Run images first, then audio and video

First validate all initial page inputs without network calls or charges:

```sh
pnpm --filter @comfyorg/website test:router-models
```

Dry preflight still writes local evidence and updates the grid's preflight
results. It does not establish that a model generates content.

Run each live command after the previous command finishes. These use the
32-worker, two-starts-per-second settings verified in the full sweep:

```sh
pnpm --filter @comfyorg/website test:router-models \
  --execute --modality image --concurrency 32 --starts-per-second 2

pnpm --filter @comfyorg/website test:router-models \
  --execute --modality audio --concurrency 32 --starts-per-second 2

pnpm --filter @comfyorg/website test:router-models \
  --execute --modality video --concurrency 32 --starts-per-second 2
```

Do not join the stages with `&&`: a model failure exits 1, but the later
modalities still need testing. Invalid preflight cases are skipped while other
selected cases continue. An all-successful run exits 0; failed or blocked checks,
cancellation and setup errors exit nonzero.

To mix every media type in a single campaign, omit `--modality`. For maximum
local parallelism, use `--concurrency 128`; the CLI accepts 1–128, independently
of the admin account setting. `--starts-per-second` controls dispatch pace and
accepts fractions. Increasing the worker count does not raise account capacity.

Every selected valid case under `--execute` submits a fresh generation request,
including previously passing pages, and live calls can incur charges. There is
no resume or skip-passed mode. To retest only selected pages, repeat `--slug` as
needed:

```sh
pnpm --filter @comfyorg/website test:router-models \
  --execute --concurrency 2 \
  --slug openai--gpt-image-1--edit-images \
  --slug vertexai--veo-3--animate-images
```

The whole-case timeout defaults to 2,700 seconds, enough for the shared Router
client's first request and three deadline collections at its 660-second
per-request limit. The shared client also caps the complete retry sequence,
including `Retry-After` waits, at 2,700 seconds. Each downloaded artifact is
limited to 256 MiB. `--timeout-seconds` and `--max-artifact-mb` adjust the tester's
limits; they cannot extend the shared client's deadline. A timeout
or Ctrl-C can leave an accepted provider job running and billable. Inspect its
saved request ID and idempotency key before deciding whether to submit again.
Use `pnpm --filter @comfyorg/website test:router-models --help` for all options.

Some asynchronous jobs finish after Router's synchronous deadline (about nine
minutes). Router then answers HTTP 504 `deadline_exceeded` and parks the
submitted generation. The shared Router client, used by both the page's Run
button and the tester, repeats the identical request with the same idempotency
key up to three times; Router hands back the original generation instead of
starting and billing another. It also waits out a `409` that carries
`Retry-After` while the original request is still settling. Any other failure is
reported without a retry. The September 11
[backend investigation](reviews/2026-09-11-backend-model-failures.md) documents
the parking behaviour. The grid labels passes that needed collection
`Collected after initial timeout` (`completion: "collected-after-timeout"`).

## Results, separate campaigns and commits

The default public files update after each result:

- [MODELS_TEST_RESULTS.md](MODELS_TEST_RESULTS.md): readable grid and failures.
- [testing/models-test-results.json](testing/models-test-results.json): persistent
  results, keyed by page, environment and input mode, preserving last success.

Partial runs preserve the other pages' live results. 3D and other unsupported
output types remain listed as untested. Use the recorded failures to decide
which pages to fix or disable; the tester does not change model availability.

## Disable or re-enable a page

A model page is published unless
[`src/data/workshop-model-availability.json`](src/data/workshop-model-availability.json)
disables it. Entries are keyed by page slug:

```json
"kling--video-extend--edit-videos": {
  "disabled": true,
  "reason": "Requires the provider ID of an earlier Kling generation, which a page cannot supply by default."
}
```

A disabled page leaves the catalogue, search, its detail route and every
legacy redirect, and the tester no longer selects it. The build fails if an
entry names a page that does not exist. The grid keeps a disabled page's last
result and marks it `Disabled` with the reason.

Disable any page whose initial defaults do not produce a decoded artifact. To
re-enable one, set `disabled` to `false` or delete its entry, run the tester for
that slug with `--execute --slug <slug>`, and commit the manifest together with
the updated grid only after the page passes.

Private evidence goes into a new, ignored `temp/router-model-tests/<run-id>/`
directory at repository root. It includes the manifest, append-only events,
prepared requests, response attachments and decoded media. Commit the two
public result files together after reviewing the run:

```sh
git add apps/website/MODELS_TEST_RESULTS.md \
  apps/website/testing/models-test-results.json
git commit -m "test(models): record production generation results"
```

One tester process owns each report; its workers run in parallel. To run an
independent campaign, use a separate report. Capture the repository root first,
because `pnpm --filter` runs the script from `apps/website` and relative custom
paths resolve there:

```sh
ROUTER_TEST_REPO="$(pwd)"
ROUTER_TEST_RUN="$(date -u +%Y%m%dT%H%M%SZ)"
pnpm --filter @comfyorg/website test:router-models \
  --execute --modality image --concurrency 32 --starts-per-second 2 \
  --output "$ROUTER_TEST_REPO/temp/router-model-tests/$ROUTER_TEST_RUN" \
  --report "$ROUTER_TEST_REPO/temp/router-model-tests/image-campaign.md"
```

The custom report's JSON is adjacent `image-campaign.json`; it does not merge
into the main grid automatically. A custom `--output` directory must not already
exist. A second process targeting the same report fails before dispatch; remove
a stale `.json.lock` only after confirming its owning tester has stopped.

For generic parameter mappings, endpoint adapters and response handling, see
[the shared rendering guide](ROUTER_RENDER.md). The recorded sweep notes cover
[image results](reviews/2026-09-11-image-sweep.md) and
[audio/video results](reviews/2026-09-11-audio-video-sweep.md).
