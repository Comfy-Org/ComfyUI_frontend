# M1 live execution smoke

This suite runs the browser against a real ComfyUI backend. It uses no HTTP
routes, response replacements, WebSocket interception, synthetic execution
events, provider stubs, or fake models. User profiles and settings are created
through the backend's real APIs. Workflows are uploaded through the UI and
submitted with the Run button.

## Requirements

- Node 26.8.2 or newer within the repository's supported major version.
- Installed workspace dependencies and Playwright Chromium/ffmpeg.
- A backend supporting `ComfySleepNode` and multi-workflow async execution.
  Validated with ComfyUI PR #17488, commit
  `63de6a8698b0947e942332abf0d84b2f396c15b9`.
- A dedicated backend started with `--cpu --multi-user --cache-none`.
  Disabling caching ensures each repetition actually executes the async nodes.

The ordinary browser suite excludes this directory because the required core
concurrency change is still a separate draft. The dedicated runner fails if
the backend cannot execute these workflows; it does not silently skip them.

## Run

Start the real backend on port 8188, then start the frontend:

```sh
DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8188 pnpm dev:test
```

In another terminal:

```sh
PLAYWRIGHT_TEST_URL=http://127.0.0.1:5173 \
PLAYWRIGHT_SETUP_API_URL=http://127.0.0.1:8188 \
M1_CORE_COMMIT=63de6a8698b0947e942332abf0d84b2f396c15b9 \
pnpm test:browser:m1-live
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an installed Chromium.
The default is Playwright's bundled browser.

## Evidence

Four cases run five times each, with one worker and zero retries:

1. A single workflow completes with matching backend history and canvas output.
2. Two real runs of one workflow overlap; the earlier run finishes while the
   later run is still active, and its running node remains visible. Each job's
   backend output is checked, followed by the final canvas output.
3. Two different workflow tabs overlap, with distinct submitted workflow IDs
   and running async nodes. Switching tabs preserves each run, the earlier
   completion leaves the foreground run active, and each canvas retains its
   own output.
4. Independent async branches appear running together in a real server
   snapshot and retain their distinct outputs.

For a manual check, import `execution/parallel_sleep.json` and
`execution/parallel_sleep_other_workflow.json` into two workflow tabs. Prepare
both tabs, run the first, then immediately run the second and keep its tab
visible. The first sleeps for six seconds and outputs `first-run`; the second
sleeps for ten seconds and outputs `other-workflow`. The second node must start
before the first job completes, and remain visibly running after that
completion. Switch back after both finish and check both canvas outputs.
The two files deliberately share node IDs while using different workflow IDs.
Change the string inputs between repetitions when backend caching is enabled.

Open `playwright-report/m1-live/index.html`, or run:

```sh
pnpm exec playwright show-report playwright-report/m1-live
```

Every execution retains a video, trace, real requests, received WebSocket
frames, job IDs, and fetched job history. The report records frontend/core
commits and the Node version. These local CPU workflows exercise real async
scheduling and frontend routing. Paid partner providers, Cloud entitlements,
billing, and the remaining M1 UI requirements need separate acceptance.
