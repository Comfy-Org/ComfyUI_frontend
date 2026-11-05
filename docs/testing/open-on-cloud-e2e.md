# Live Open on Cloud E2E

The suite uses a real local ComfyUI backend and a deployed Cloud test or PR environment. Every compatibility response comes from the configured Cloud origin. The fixture permits the app's required external services and retains the shared network guard. It installs no response replacements, auth stubs, or workflow scenario switches.

## Prerequisites

- Start a local ComfyUI backend.
- Start the frontend with the Cloud destination set to the deployment under test.

```sh
VITE_STAGING_CLOUD_BASE_URL=https://fe-pr-22949.testenvs.comfy.org pnpm dev --host localhost --port 5173 --strictPort
```

- Confirm `http://localhost:8188/system_stats` and `http://localhost:5173/` respond.
- Install the Chromium version required by the repository's Playwright dependency.
- The local development build enables `open_on_cloud_enabled`. The three tests use fresh signed-out browser contexts.

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

`browser_tests/tests/liveCloud/openOnCloudLogin.spec.ts` separately checks that Open on Comfy Cloud opens the selected deployment's actual login page in a new tab. Run it with the same environment variables, replacing the spec path in the command above. Its fixture permits the hosted application's analytics and diagnostic services as well as its application requests. Follow the execution environment's authorization requirements before running it.

## Remaining acceptance work

Authenticated local-to-Cloud import and Cloud execution require an authenticated Cloud browser context and an enabled receiver flag. These are separate from the three compatibility cases and the signed-out login test. The actual model-upload flow remains incomplete in the implementation and requires its own live upload acceptance once available.
