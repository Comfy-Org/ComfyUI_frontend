# Live Open on Cloud E2E

The suite uses a real local ComfyUI backend and a deployed Cloud test or PR environment. Every compatibility response comes from the configured Cloud origin. The fixture permits the app's required external services and retains the shared network guard. It installs no response replacements, auth stubs, or workflow scenario switches.

> [!NOTE]
> The specs below land with the Open on Cloud feature PRs: `openOnCloud.spec.ts` in #23071, `openOnCloudLogin.spec.ts` in #23074 and `desktopWorkflowRelay.spec.ts` in #23075. Until those merge, the suites are unavailable on `main`.

## Prerequisites

- Start a local ComfyUI backend.
- Start the frontend with the Cloud destination set to the deployment under test.

```sh
VITE_STAGING_CLOUD_BASE_URL=https://fe-pr-22949.testenvs.comfy.org pnpm dev --host localhost --port 5173 --strictPort
```

- Confirm `http://localhost:8188/system_stats` and `http://localhost:5173/` respond.
- Install the Chromium version required by the repository's Playwright dependency.
- The local development build enables `open_on_cloud_enabled`. The compatibility and login tests use fresh signed-out browser contexts.

## Run

```sh
PLAYWRIGHT_CLOUD_LIVE=1 \
PLAYWRIGHT_TEST_URL=http://localhost:5173 \
PLAYWRIGHT_SETUP_API_URL=http://127.0.0.1:8188 \
OPEN_ON_CLOUD_URL=https://fe-pr-22949.testenvs.comfy.org \
pnpm test:browser browser_tests/tests/liveCloud/openOnCloud.spec.ts \
  --project=cloud-live --workers=1 --reporter=line,html
```

Set both the development server's Cloud destination and `OPEN_ON_CLOUD_URL` when selecting another deployment. The response assertion checks that the browser contacted that exact origin.

## Acceptance cases

| Priority | Workflow                                         | Expected real response and user outcome                                                                                       |
| -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| P1       | EmptyImage connected to SaveImage                | No missing nodes or models. Show Run on Comfy Cloud with the signed-out explanation and the Open on Comfy Cloud action.       |
| P1       | VAELoader connected to VAESave                   | Cloud reports VAESave missing. Show Deploy your setup and the Claude, ChatGPT, and copy-prompt choices.                       |
| P1       | SD workflow using 3Guofeng3_v32Light.safetensors | Cloud reports that checkpoint missing and no missing nodes. Show the exact filename and the local-upload availability notice. |

Each case asserts HTTP 200, a real server address, the parsed compatibility payload, and the corresponding rendered UI. The report includes a screenshot for each result.

## Hosted sign-in handoff

`browser_tests/tests/liveCloud/openOnCloudLogin.spec.ts` separately checks that Open on Comfy Cloud opens the selected deployment's actual login page in a new tab. Run it with the same environment variables, replacing the spec path in the command above.

The login fixture permits the hosted application's analytics, diagnostics, and Impact marketing attribution requests, including `www.ojrq.net`. It does not replace responses or suppress the marketing script. Marketing attribution is outside this suite's acceptance assertions. Follow the execution environment's authorization requirements before running it.

## Remaining acceptance work

Authenticated local-to-Cloud import and Cloud execution require an authenticated Cloud browser context and an enabled receiver flag. These are separate from the three compatibility cases and the signed-out login test.

A verified `@comfy.org` employee can use the existing Cloud override `?ff=open_on_cloud_enabled:true` for controlled import acceptance. To carry it automatically into a new browser or Desktop handoff tab, configure the local frontend's `VITE_STAGING_CLOUD_BASE_URL` as `https://fe-pr-22949.testenvs.comfy.org/?ff=open_on_cloud_enabled:true`. The handoff retains configured `ff` parameters; the Cloud receiver still checks the real signed-in employee identity. This changes the rollout configuration without replacing authentication, API responses or the workflow loader.

The Issues panel offers deployment for an out-of-memory error when `open_on_cloud_enabled` is enabled. Its error-catalog routing and dialog action are covered together by the focused integration suite. The live suite does not exhaust GPU memory to produce this condition.

A missing local opener, or a sender that no longer answers after sign-in, shows **Your workflow didn't arrive** with instructions to reopen from local ComfyUI. The sender waits ten minutes; the Cloud receiver waits up to one minute for a response after it loads.

Local model upload, background progress, cancellation, and sign-in-to-upload remain incomplete. The local asset-content API requires ComfyUI's assets system (`--enable-assets`); the live backend used here has it disabled and returns HTTP 503. The Cloud loopback CORS route allowlist permits compatibility checks but does not permit `/api/assets/uploads` or its completion route; the preview's upload preflight returns HTTP 404 without `Access-Control-Allow-Origin`. A supported local model-content capability and Cloud upload transport are required before these user stories can be accepted. The unavailable notice remains visible instead of a nonfunctional Upload button.

Desktop stages a short-lived transfer in the real local userdata API and opens a local relay through its native external browser. The relay consumes that record and carries the compressed workflow in a Cloud URL fragment. Cloud removes the fragment before telemetry, preserves the transfer in tab session storage through sign-in and imports it through the normal validator. Ten-minute expiry and payload limits retain download/manual-import fallback when transport is unavailable.

`browser_tests/tests/liveCloud/desktopWorkflowRelay.spec.ts` covers the real userdata GET/DELETE and hosted login, plus missing and expired records. Run it with the same live-suite environment variables. It proves browser relay transport; authenticated import and native Desktop window acceptance are additional checks.
