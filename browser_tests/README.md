# Browser (Playwright / E2E) Tests

How to set up, run, and debug the Playwright browser tests. Conventions for
writing tests (structure, tags, typed mocks, flake prevention) are in
[`docs/guidance/playwright.md`](../docs/guidance/playwright.md).

## Prerequisites

For real Cloud billing E2E setup and account prerequisites, see [Cloud billing E2E coverage](../docs/testing/cloud-billing-e2e.md).
Its dedicated runner requires real authentication and a dedicated sandbox account;
the live suite is excluded from the ordinary browser test configurations.

**CRITICAL**: Start the ComfyUI backend with `--multi-user`:

```bash
python main.py --multi-user
```

Without this flag, parallel tests conflict and fail randomly.
`pnpm container:start` already passes it.

## Setup

### ComfyUI devtools

ComfyUI_devtools ships in this repo under `tools/devtools/` and is copied into
`custom_nodes` automatically during CI. It adds API endpoints and nodes used by
browser tests. For local development, copy it into your ComfyUI install (create the target
directory first — it won't exist on a fresh install):

```bash
mkdir -p /path/to/your/ComfyUI/custom_nodes/ComfyUI_devtools
cp -r tools/devtools/* /path/to/your/ComfyUI/custom_nodes/ComfyUI_devtools/
```

### Containerized ComfyUI

To run a containerized ComfyUI backend instead of maintaining a separate
install, install and start Docker, then run:

```bash
pnpm container:start
```

The command mounts `tools/devtools` and starts ComfyUI at `localhost:8188`.
Leave it running. Use another terminal for `pnpm dev:test` and a third for
`pnpm test:browser:local`.

Run browser tests against port 5173 when using this container. Port 8188 serves
the frontend bundled into the container, not the current frontend checkout.

The CI image is private. If it is not cached, the launcher pulls it from GHCR
with `GH_TOKEN` and gets the matching username from `gh api user`.
`COMFY_CI_CONTAINER_TOKEN` and `COMFY_CI_CONTAINER_USER` take precedence when
set. The token must be a personal access token (classic) with the
`read:packages` scope, owned by an account that can read
`comfy-org/comfyui-ci-container`. GHCR rejects fine-grained tokens.
`gh auth status` lists the scopes of the current `GH_TOKEN`.

If credentials are missing or the pull fails, the launcher says why and builds
the matching release from source instead. This fallback may differ from the
published CI image. The build takes 15 to 20 minutes and uses about 10 GB, plus
Docker build cache. Its `apt-get` steps can pause for minutes on slow Ubuntu
mirrors and then continue. Later starts reuse the built image.

The launcher log shows which path it took:

| Log line                                                                 | Meaning                                      |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `Using cached image ghcr.io/...`                                         | CI image; the backend starts within seconds  |
| `Status: Downloaded newer image for ghcr.io/...`                         | CI image pulled in about a minute            |
| `GHCR credentials are not configured` or `The private image pull failed` | A source build follows                       |
| `Using source-built fallback ...`                                        | Fallback image is built; ComfyUI is starting |
| `To see the GUI go to: http://0.0.0.0:8188`                              | Backend ready                                |

### Remote agent containers

Agent containers run the backend and the dev server as background services.
In Amp orbs, `.agents/setup` installs Docker and `.amp/services.yaml` declares
`docker-daemon`, `comfyui` (`pnpm container:start`), and `frontend`
(`pnpm dev:test` on 5173). `amp orb services ensure` starts them and waits for
their ports; stopping it early leaves them starting. The `frontend` service
waits about 10 minutes for the backend, then exits and restarts, so a long
source build needs no intervention. Other platforms can run the same commands
as services.

Store the GHCR token as a container secret: add `read:packages` to `GH_TOKEN`,
or set `COMFY_CI_CONTAINER_TOKEN` to keep that scope off `GH_TOKEN`. Restart
the container processes after changing secrets.

Set `COMFYUI_FRONTEND_MODE=cloud` to skip Docker and the local backend and run
the frontend against the Comfy test cloud for manual work. E2E needs local
mode. The regular Playwright projects, `cloud` included, all run against the
local backend.

### Node.js & Playwright

Install the Node version in `.nvmrc`, then the workspace dependencies and the
Chromium and WebKit drivers (run from the repository root):

```bash
pnpm install
pnpm exec playwright install chromium webkit --with-deps
```

### Environment

Start the dev server with `pnpm dev:test`. It removes the Vue dev overlay that
blocks UI elements (`DISABLE_VUE_PLUGINS`) and loads the default workflow CI
builds with (`VITE_USE_LEGACY_DEFAULT_GRAPH`).

Create `.env` from the template and set the debugging keys:

```bash
cp .env_example .env
```

```bash
# Test against dev server (recommended) or backend directly
PLAYWRIGHT_TEST_URL=http://localhost:5173      # Dev server
# PLAYWRIGHT_TEST_URL=http://localhost:8188     # Direct backend
PLAYWRIGHT_SETUP_API_URL=http://localhost:8188 # Setup/auth API when using the dev server

# Path to ComfyUI for backing up user data/settings before tests
TEST_COMFYUI_DIR=/path/to/your/ComfyUI
```

### Release API mocking

By default all tests mock `api.comfy.org/releases` so release popups don't cover
UI elements. To supply a custom release response before the first app load:

```typescript
test.use({ mockReleases: false })
```

Install the replacement route in a test-scoped auto fixture that depends on
`page`, before `comfyPage` boots. Disabling the default mock does not disable
network isolation. See `fixtures/releaseNotificationFixture.ts` and
`tests/releaseNotifications.spec.ts` for release-specific responses and request
tracking.

### Network isolation

The live Cloud routing infrastructure spec requires `openssl` on PATH to generate
a disposable localhost TLS certificate; it does not use a live account.

The shared fixtures allow HTTP and real WebSockets only to the configured
frontend/backend origins: `PLAYWRIGHT_TEST_URL`, `PLAYWRIGHT_SETUP_API_URL`,
`DEV_SERVER_COMFYUI_URL`, and Playwright's `baseURL`. Every other browser
request needs a mock; see
[Network isolation](../docs/guidance/playwright.md#network-isolation) for the
test-authoring rules.

Both `request` and `context.request` reject external URLs and disable automatic
redirect following. Node networking, new standalone request/browser contexts,
`route.fetch()`, and browser redirects can bypass fixture routing. For a full
test-process network boundary, run the frontend, backend, and tests together
in a Docker container with networking disabled:

```bash
pnpm install --frozen-lockfile
VITE_USE_LEGACY_DEFAULT_GRAPH=true pnpm build
docker pull ghcr.io/comfy-org/comfyui-ci-container:0.0.28
scripts/test-browser-offline.sh --project=chromium errorDialog.spec.ts
```

Complete downloads and builds first. The offline runner never pulls an image
or invokes the package manager. It requires a Linux-compatible `node_modules`
and a cached CI image. `COMFYUI_TEST_IMAGE` selects a source-built image;
`PLAYWRIGHT_OFFLINE_DIST` selects another built distribution, such as a cloud
build for `--project=cloud` or `--project=mobile-safari`. Remote backend runs
still use the regular test commands, not the offline runner.

The container runs as root so the bundled backend can write to `/ComfyUI`.
Generated reports are root-owned on the host. Before running tests outside the
container, restore ownership of each generated output directory with
`sudo chown -R "$(id -u):$(id -g)" test-results`, substituting
`playwright-report`, `blob-report`, `coverage`, or your `--output` directory
when used.

## Recording Tests (For Non-Developers)

If you're a QA tester or non-developer, use the interactive recorder:

```bash
pnpm comfy-test record
```

`pnpm comfy-test recorder` is an equivalent alias and accepts the same flags.

This guides you through a 6-step flow:

1. **Environment check** — verifies the tools, the backend, and the dev server (with install instructions if anything is missing)
2. **Project setup** — installs dependencies
3. **Configure** — set test name, tags, and starting workflow
4. **Record** — opens the browser with the Playwright Inspector; press Record, act, then close both windows — the generated code is saved automatically as you go, no copy/paste
5. **Transform** — the captured code is rewritten to project conventions automatically
6. **Refactor (optional)** — offers to hand the spec to a local coding-agent CLI (Claude Code, Codex, Gemini CLI, ...) for a convention pass, if one is installed

Then, if you want, it opens a PR for you via `gh` CLI (or gives manual instructions).

`record` needs a real terminal — it exits immediately with guidance if run
without one (piped input, CI, etc).

The dev server must be serving _this_ checkout. Step 1 fails if the port is
held by a server started from a different folder. To use another port:

```bash
pnpm dev --port 5174 --strictPort
COMFY_TEST_DEV_PORT=5174 pnpm comfy-test record
```

### For agents

`record` is built around a human clicking a real browser and can't be
driven programmatically. An agent should use `comfy-test plan` instead —
fully non-interactive, no terminal required:

```bash
pnpm comfy-test plan --description "collapsing a KSampler node keeps its connections" \
  --tags @canvas,@widget
```

This validates the environment/tags/workflow and prints a test-plan block
ready to hand to the `playwright-test-generator` agent
(`.claude/agents/playwright-test-generator.md`), which drives the app via
Playwright MCP tools and writes a convention-compliant spec directly — no
`transform` step needed. Then open the PR:

```bash
pnpm comfy-test pr browser_tests/tests/<slug>.spec.ts
```

Other commands:

```bash
pnpm comfy-test check       # Just run environment checks
pnpm comfy-test plan --description "<what to test>"  # Print a plan for playwright-test-generator
pnpm comfy-test transform <file>  # Transform a raw codegen file
pnpm comfy-test pr <file>   # Open a PR for a generated test
pnpm comfy-test list        # List available workflow assets
```

## Running Tests

Start the backend and the dev server first (see [Setup](#setup)). Both checks
must pass:

```bash
curl -sf localhost:8188/system_stats >/dev/null && echo backend ready
curl -sf localhost:5173/ >/dev/null && echo frontend ready
```

```bash
pnpm test:browser:local                     # Run all E2E tests
pnpm test:browser:local widget.spec.ts      # Run a specific file
pnpm test:browser:local --ui                # Interactive UI mode (use for development)
```

Run the first spec after the dev server starts with one worker, the
`test:browser:local` default. Vite compiles the app on the first page load, and
parallel workers against a cold server time out in `beforeEach` with
`app never became ready`.

**Use UI mode while developing.** It provides:

- **Locator picker** — click an element to get its exact locator code
- **Step debugging** — step through a test line by line via the _Source_ tab
- **Time travel** — click any step in _Actions_ to see browser state at that moment
- **Console / Network / Attachments** tabs — logs, API calls, and snapshot diffs

### Environment failures

Rule these out before blaming the change under test:

| Symptom                                                    | Cause                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `connect ECONNREFUSED` on 5173 or 8188                     | Backend or dev server not running yet                   |
| `app never became ready` on the first run only             | Cold Vite with parallel workers; rerun                  |
| Default-graph nodes such as `Load Checkpoint` are missing  | Dev server without `VITE_USE_LEGACY_DEFAULT_GRAPH=true` |
| Backend-provided data differs on the source-built fallback | Fallback differs from the CI image; confirm in CI       |

A failure that also reproduces on the merge base is not caused by the change. The
dev server serves whatever the checkout holds, so rerun the spec after
`git switch --detach "$(git merge-base HEAD origin/main)"`, then switch back.

`vueDirectiveSentryAttribution.spec.ts` needs a production build: the dev
server initialises Sentry with `enabled: false`, so no envelope is ever sent and
the spec waits out its timeout. CI runs it in the `mobile-safari` project
against the `frontend-dist-cloud` artifact. Locally, run
`DISTRIBUTION=cloud pnpm build:cloud`, start ComfyUI with
`--front-end-root <repo>/dist`, and run the spec with
`PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:8188 DISTRIBUTION=cloud`
and `--project=mobile-safari`.

### Slowing the browser down

With `--headed` or `--ui`, set `SLOW_MO` (ms) to slow every action. Applies only
when `PLAYWRIGHT_LOCAL` is set (the default for `test:browser:local`):

```bash
SLOW_MO=250 pnpm test:browser:local --headed widget.spec.ts
```

## Custom-node regression suite

`tests/customNodes/` holds the manifest-driven suite that proves community
custom-node packs load, render in both renderers (LiteGraph canvas and Vue
Nodes 2.0), and execute real workflows. It has its own prerequisites, pnpm
scripts (`pnpm test:custom-nodes` and variants), and a one-JSON-row process
for adding packs - see
[docs/custom-node-regression-suite.md](../docs/custom-node-regression-suite.md).

## Screenshot / Visual Regression Testing

Screenshot expectations are **platform-specific** (font rendering). We maintain
**Linux** baselines because CI runs on Linux.

- **Do not commit local screenshot baselines.**
- How to write a screenshot assertion is in
  [Screenshots](../docs/guidance/playwright.md#screenshots).

### Working with screenshots locally

Skip screenshot tests locally:

```typescript
// playwright.config.ts
export default defineConfig({
  grep: process.env.CI ? undefined : /^(?!.*screenshot).*$/
})
```

`grep` matches the test title and its tags, not the test body — a screenshot
assertion alone won't be detected. Tag every screenshot test
`@screenshot` (or put "screenshot" in its title) for this filter to exclude it.

Or generate local baselines for comparison (do not commit them). If you added
the screenshot-skipping `grep` above, remove it (or override `--grep` for this
run) — otherwise `--update-snapshots` won't regenerate the excluded baselines:

```bash
pnpm test:browser:local --update-snapshots
```

### Creating new baselines in CI

1. Write the test with one of the screenshot helpers in
   [Screenshots](../docs/guidance/playwright.md#screenshots).
2. Add the **`New Browser Test Expectations`** label, comment
   `/update-playwright`, or tick the "Update Playwright expectations"
   checkbox in the Playwright section of the PR report comment.

The workflow waits for the PR's `CI: Tests E2E` run and commits the actual
image of every screenshot assertion that failed there (stale or missing
baseline) without rerunning Playwright. A flaky screenshot that passed on
retry is never committed, and a run with no failed screenshot assertions
commits nothing. The workflow fails and says why when there is no run for
the head commit, the run takes over 45 minutes, a Playwright job did not
finish, no Playwright job ran, or a Playwright job left no
`snapshot-updates-*` artifact (for example after a crash or once the
artifacts expire after 7 days). Push to the branch for a new E2E run and
trigger the update again, or comment `/update-playwright full` to rerun the
`@screenshot` suite with `--update-snapshots`.

A failed screenshot assertion ends its test, so only the first stale
screenshot of each test is committed and the next E2E run fails on the
following one. Comment `/update-playwright full` when a change affects
several screenshots in one test.

Fork PRs can't auto-commit screenshots — a maintainer commits them for you.

## Debugging in CI

1. Download artifacts from the failed run.
2. View the trace: `pnpm dlx playwright show-trace trace.zip`.
3. CI deploys an HTML report to Cloudflare Pages (link in the PR comment).
4. Reproduce CI locally: `CI=true pnpm test:browser`.

## Test Reports (Cloudflare Pages)

Reports deploy automatically for every PR and push to main branches, one
Cloudflare Pages project per browser configuration
(`comfyui-playwright-chromium`, `-mobile-chrome`, `-chromium-2x`,
`-chromium-0-5x`), with branch-specific URLs
(`https://[branch].comfyui-playwright-[browser].pages.dev`). PR comments carry
✅/❌ status and direct report links per browser.

## New-Test Video Walkthrough

CI re-runs any Playwright spec file newly added in a PR (detected via
`git diff --diff-filter=A` against the base branch) with video recording
enabled and deploys the resulting HTML report — Playwright's report embeds
the video inline per test — to the same `comfyui-playwright-chromium`
Cloudflare Pages project, on its own branch. The link is posted alongside
the other browser report links in the PR comment. It's scoped to added
files only — the existing suite always runs without video — to keep CI cost
and time bounded. Recording is opt-in via `RECORD_VIDEO=true` (set only by
that CI job; see `playwright.config.ts`) and slowed down with `SLOW_MO` so
the result is legible for reviewers. Files containing no tests eligible for
the `chromium` project, such as `@perf`-only specs, are skipped with an
explanation in the workflow summary. Newly added `@audit` tests fail this
job instead because the audit project has no regular CI coverage.

## Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode) ·
  [Debugging](https://playwright.dev/docs/debug) ·
  [Auto-retrying assertions](https://playwright.dev/docs/test-assertions#auto-retrying-assertions)
- [act](https://github.com/nektos/act) — run GitHub Actions locally
