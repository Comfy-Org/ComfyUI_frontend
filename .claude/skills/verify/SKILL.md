---
name: verify
description: 'Launch and drive the ComfyUI Cloud frontend (Vue web app) against a real Comfy backend, and capture evidence that a change works. Use when proving cloud billing, auth, workspace or canvas behaviour end to end, especially billing SDK rail migrations, where the UI is identical on both transports and only the network tells you which one ran.'
---

# Verify the ComfyUI Cloud frontend

This repo's user surface is a **Vue 3 web app** served by Vite. The cloud build (`DISTRIBUTION=cloud`) talks to a remote Comfy backend for auth, workspaces and billing. Verification means: run the local build against a real backend, drive the UI as a user, and capture network + screen evidence.

Two other surfaces exist and are **not** covered here: `apps/billing-web` (its own Playwright suite, `pnpm --filter @comfyorg/billing-web test:e2e`) and the desktop/Electron build.

## Launch

```bash
nvm use 26 && pnpm dev:cloud
```

- Node **26** is required (`.nvmrc` = `26`, `package.json` engines `>=26.8.2 <27`). `nvm install 26` if missing.
- `dev:cloud` → `dev:cloud:test` → `DEV_SERVER_COMFYUI_URL=https://testcloud.comfy.org/`. Vite infers `DISTRIBUTION='cloud'` from the `.comfy.org` host (`vite.config.mts:131-138`), which is what makes `isCloud === true` and the `?ff=` override path reachable.
- Ready when stdout has `VITE v8.x ready in` and `➜  Local:   http://localhost:5173/`. Serving takes ~1s; a first run may spend ~30s on `pnpm install` and dependency re-optimization first.
- **Never use `dev:cloud:prod`.** It proxies to `https://cloud.comfy.org`, which is real production with real customers and real money. `dev:cloud:staging` (stagingcloud) is the only other safe target.

Teardown: see Cleanup.

### What this combination buys you

The local frontend is whatever `main` currently holds; the backend is real. That is the only way to exercise code that has not shipped to an environment yet. As of 2026-09-21 `testcloud.comfy.org` serves **1.54.13** (`origin/cloud/1.54`), which does **not** contain the billing SDK migration. The migration is reachable _only_ through this local setup.

## Doctor

Run all four before driving. Each is read-only and takes seconds.

**1. Is the code under test actually being served?** Vite serves transformed source over HTTP, so you can grep the running build with no auth and no browser:

```bash
curl -s http://localhost:5173/src/composables/useFeatureFlags.ts | grep -o 'billing_sdk_[a-z_]*' | sort -u
```

Expect `billing_sdk_subscription_enabled` and `billing_sdk_topup_enabled`. Empty output means the checkout does not contain the migration. Stop, because nothing below is meaningful. (The same grep against a deployed bundle is how you prove what an _environment_ is running.)

**2. Is the cloud distribution live?** In the page console:

```js
const m = await import('/src/platform/distribution/types.ts')
m.isCloud
```

Must be `true`. `false` means the dev server was started without a `.comfy.org` backend URL, and every `?ff=` override will be silently inert. Note that `curl` on this module shows the unreplaced `__DISTRIBUTION__` token. The `define` substitution lands in the browser pipeline, so check it in the page, not with curl.

**3. What is the backend actually serving?** The features proxy answers without auth:

```bash
curl -s http://localhost:5173/api/features | python3 -m json.tool | grep -E 'unified_cloud_auth|billing_sdk|embedded_checked'
```

Read the values, do not assume them. On testcloud as of 2026-09-21: `unified_cloud_auth: false`, both `billing_sdk_*: false`, `embedded_checked_enabled: false`.

**4. Does the tab render frames?** Browser automation often drives a hidden tab. The Claude-in-Chrome tab reports `document.visibilityState === 'hidden'` and runs `requestAnimationFrame` at 0 frames per second. In the page console:

```js
await new Promise((resolve) => {
  let frames = 0
  const start = performance.now()
  const tick = () =>
    performance.now() - start < 1000
      ? (frames++, requestAnimationFrame(tick))
      : resolve(frames)
  requestAnimationFrame(tick)
  setTimeout(() => resolve(frames), 1500)
})
```

At 0 frames, Vue transitions never finish. A removed PrimeVue toast keeps its DOM node with `p-toast-message-leave-active` at opacity 0, and a new one sticks at `p-toast-message-enter-from`, so DOM queries report toasts a real user never sees. In that case assert on component state instead. Walk `el.__vueParentComponent` up to the component whose `type.name` is `Toast` and read `proxy.messages`. A 2026-09-21 run filed a false "verify toast stays after the top-up settles" finding this way.

## Drive

### Flipping feature flags

Read this before anything else. Two override mechanisms exist and they fail differently.

`?ff=<name>` (`src/utils/sessionFeatureFlagOverride.ts`) works on any cloud build including production, persists in `sessionStorage` for the tab, and has **two fail-closed gates**:

```ts
if (!isCloud) return undefined
if (!isComfyEmployee()) return undefined // emailVerified AND @comfy.org
```

**When a gate fails the override is silently ignored, and `sessionStorage` still shows it as captured.** Verified signed-out on 2026-09-21: storage held `{"unified_cloud_auth":true,"billing_sdk_topup_enabled":true}` while `getSessionOverride()` returned `undefined` and every resolved flag stayed `false`. Inspecting storage does not tell you the override took. Resolve the flag instead:

```js
const { flags } = (
  await import('/src/composables/useFeatureFlags.ts')
).useFeatureFlags()
flags.billingSdkTopupRailEnabled
```

`ff:<name>` in `localStorage` (`src/utils/devFeatureFlagOverride.ts`) has **no employee gate** but is tree-shaken out of production builds, so it works on this local dev server and nowhere else. Use it when you cannot sign in as an employee:

```js
localStorage.setItem('ff:billing_sdk_topup_enabled', 'true')
```

Never set `ff:unified_cloud_auth`. It already resolves `true` for a signed-in user, and forcing it put the app into a reload loop.

Precedence (`useFeatureFlags.ts:64-74`): session override → dev override → `/api/features` remote config → websocket server feature.

**`?ff=` is captured per tab and keyed on the query string. Open a fresh tab when changing scenario**, or the previous override is still live.

### Driving the UI

**Automated, mutation-free.** The `cloud-live` Playwright project runs against a real backend with a hard allowlist in `browser_tests/fixtures/utils/liveCloudBillingPolicy.ts`: `isLiveCloudMutationAllowed` permits only Firebase sign-in, token mint and `POST /customers`. **Every billing mutation is blocked**, so this cannot charge anything. Point it at the local dev server:

```bash
PLAYWRIGHT_CLOUD_LIVE=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 \
PLAYWRIGHT_SETUP_API_URL=https://testapi.comfy.org \
CLOUD_ACCOUNT_EMAIL=... CLOUD_ACCOUNT_PASSWORD=... \
pnpm exec playwright test --project=cloud-live --workers=1
```

Specs live in `browser_tests/tests/liveCloud/`. `liveCloudBillingConfig.ts` rejects production origins by schema. See `docs/testing/cloud-billing-e2e.md`.

**Mocked.** For FE branch logic with no backend, use the `@cloud` project (`grep: /@cloud/`) with `setupCloudApp()` from `browser_tests/fixtures/utils/cloudAppSetup.ts`. Auth via `CloudAuthHelper.mockAuth()` (seeds the Firebase record into IndexedDB, must run before navigation). Flags via `FeatureFlagHelper`. Use `mockServerFeatures()` or `seedServerFlags()`, **not** `ff:`, which cannot reach a production dist.

**Interactive / anything that pays.** Drive the real browser. Mutations are deliberately unreachable from `cloud-live`, so checkout, subscribe, cancel and plan change have to be clicked. Sign-in is the human's step: never type someone's password.

### Stable handles

Prefer page objects already in `browser_tests/fixtures/components/` (`TopUpCreditsDialog.ts`, `CancelSubscriptionDialog.ts`) over ad-hoc selectors; they carry the real selectors and survive refactors.

### Telling the two billing transports apart

Both rails POST the same body to the same endpoint, so the body cannot separate them. The transport can:

|              | resourceType  | `Idempotency-Key` header           |
| ------------ | ------------- | ---------------------------------- |
| **SDK rail** | `fetch`       | present on writes, absent on reads |
| **Legacy**   | `xhr` (axios) | absent                             |

The SDK adds the header only when a request carries an idempotency key, and its readers never do. So a read is attributed by `fetch` plus the `/api/billing/*` path alone.

In DevTools: Network, filter `/api/billing/`. In Playwright: `request.resourceType()` and `request.headerValue('idempotency-key')`. This is the discriminator `topUpSdkRail.spec.ts:26-31` uses.

### Observing SDK-rail requests on the dev server

These traps were verified on 2026-09-21.

- **`performance.getEntriesByType('resource')` starts useless.** Vite serves every ES module as its own request; the 250-entry resource buffer is full of module loads before the first billing call and the billing entries are evicted. After load run `performance.clearResourceTimings(); performance.setResourceTimingBufferSize(4000)`, then trigger the reads (the **Refresh credits** control next to _Total credits_ re-issues `balance`/`status`; the panel alone serves cached store values).
- **A `window.fetch` wrapper installed after boot never sees the SDK.** The SDK captures its fetch reference at module init, so a post-boot patch catches every legacy `xhr` call and zero SDK calls, which reads as "the rail never turned on". Patching `XMLHttpRequest.prototype` does work for legacy. Use resource timing (`initiatorType` `fetch` vs `xmlhttprequest`) as the discriminator; it cannot show headers, so `Idempotency-Key` needs Playwright.
- The Claude-in-Chrome `read_network_requests` / `read_console_messages` hooks only record from the moment they are first called. Arm them, then reload.

### Reading the backend directly, scoped like the app does

Scope rides in the credential, not a header (`packages/account-core/src/core/billing/transport.ts:12`); `X-Workspace-Id` is ignored. A plain Firebase ID token reads the **personal** scope. To read a workspace the way the SDK does, mint the workspace token first:

```js
const id = await import('/src/platform/auth/firebaseIdentity.ts')
const fb = await id.firebaseIdentity.currentUser().getIdToken()
const wsId = localStorage.getItem('Comfy.Workspace.LastWorkspaceId')
const m = await (
  await fetch('/api/auth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + fb,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workspace_id: wsId })
  })
).json() // { token, workspace, role, … }
await (
  await fetch('/api/billing/events', {
    headers: { Authorization: 'Bearer ' + m.token }
  })
).json()
```

Never print the tokens. Balance units convert to UI credits at a fixed factor per workspace, applied to both buckets. It was ×2.11 for the team workspace used on 2026-09-21. Compare ratios, not raw numbers.

### Payment clicks and the permission classifier

In auto mode the Claude Code classifier blocks the click that initiates a payment (`Add credits` / `Pay $…`) on every tool surface, browser MCP and `orca computer click` alike, while every step up to it passes. The run needs bypass permissions (or a permission rule) for that one click; everything after (polling, settlement, evidence) is read-only again. Do not craft commands to slip past it.

## Evidence

Everything goes under `temp/verify-evidence/<scenario>/` (`/temp/` is gitignored, so artifacts stay local and never reach a commit).

Capture, per run:

- **Rail attribution.** A HAR or a request table showing resourceType and path for every `/api/billing/*` call, and `Idempotency-Key` for every write, including the _first_ `status` and `balance` of the page load. The rail is decided before the first read, so a late check proves nothing. Prefer the request table. If you save a HAR, strip `Authorization`, `Cookie`, `Set-Cookie` and any token headers or query values before writing it to disk; if the capture tool cannot redact, record only whether each header was present.
- **The numbers.** Credits total, plan name, renewal date, and the first three usage-log rows. These are the parity baseline; a migration is only correct if a customer cannot tell which rail they are on.
- **Screenshots.** The action and the resulting state, not just the final screen.
- **Console.** Error count with the rail off vs on. A new error that only appears on one rail is a finding.

Proof standards: drive the real user path, never an internal setter or a test-only endpoint. Verify the side effect (balance actually moved, a usage-log row actually appeared) alongside what the screen says. Mock only where a production boundary already isolates the external system. For a rail migration the whole point is the real wire, so mocking the backend defeats the test.

When something looks safe because it is called a test mode, confirm it by observing rather than trusting the name. For payments, check the provider page actually shows its TEST MODE banner before completing one.

## Cleanup

- Stop the dev server by the PID you started, or the background task id you launched it with. **Never `pkill -f vite`.** This machine may be running other worktrees' servers on other ports.
- Clear per-tab flag state by closing the tab, or navigate once to a bare `?ff=` which clears every override in the session (`sessionFeatureFlagOverride.ts:118-121`). Clear `ff:` keys from `localStorage` separately; they persist.
- `pnpm dev:cloud` runs `pnpm install` first and may re-sync `node_modules` to the lockfile. Confirm `git status --porcelain` is empty afterwards.
- **Cleanup never deletes `temp/verify-evidence/`.** Evidence outlives the run.

## Helpers

None shipped yet. Each command above is written to be pasted as-is.
