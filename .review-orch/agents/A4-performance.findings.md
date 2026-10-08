## Agent: performance-profiler

### Findings

#### [m1] Remote Syft SDK is script-injected eagerly at provider construction for every cloud session
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:486-488` (constructor → `bootstrapSyftClient`, lines 452-475)
- **Severity:** minor
- **Category:** performance
- **Description:** The constructor unconditionally calls `bootstrapSyftClient()`, which — when `syftdata_source_id` is set and no GTM `window.syft` exists — creates the stub and calls `loadSyftSdk()`, injecting the remote `syft.umd.js` `<script>` and firing a network request during `initTelemetry()`. Scenario: an anonymous cloud user who opens the app and never signs in / restores a session still pays the full cost of fetching, parsing, and executing the third-party Syft SDK. That cost is incurred on every cloud page load regardless of whether an `identify` ever happens. Because `identifyUser()` also calls `bootstrapSyftClient()`, the load could instead be deferred to the first `trackAuth`/`trackUserLoggedIn` call, so unauthenticated sessions pay nothing.
- **Suggestion:** Drop the eager injection from the constructor (keep it lightweight/no-op) and let the first `identifyUser()` bootstrap+load lazily; or gate the eager load behind a config flag. Note the PR description implies eager page-load capture may be intentional (reusing the GTM tag), so confirm intent before changing.
- **Confidence:** Medium — the extra network+parse cost for non-auth sessions is real, but the eager behavior may be a deliberate page-load-capture design choice, which lowers severity.

#### [m2] Stub `q`/`fi` arrays can accumulate unbounded if the real SDK loads but never drains them
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:425-450` (`createSyftStub`, `enqueue`)
- **Severity:** minor
- **Category:** performance
- **Description:** `enqueue()` pushes every call onto `q` with no cap. Two bounded-in-practice scenarios: (a) between stub creation and the SDK `error`/timeout (up to the loader's 10s timeout), any `identify` calls queue into `q`; the failure handler then `delete`s `window.syft`, so the stub (and `q`) become garbage — bounded. (b) After the real SDK is installed, `bootstrapSyftClient()` returns the real `window.syft` and `identify` runs on it, so the stub stops growing. The residual risk is a real SDK that installs itself as `window.syft` but never consumes the queued `q` entries — those entries leak for the page lifetime. Given this provider only enqueues `identify` (an infrequent auth event, ~1 per session), the practical growth is negligible, so this is a latent/defensive concern rather than an observed leak.
- **Suggestion:** No action needed for current call volume. If `track`/`page` ever become high-frequency on the stub, cap `q` length (drop oldest) as a safety valve.
- **Confidence:** Low — bounded by the failure handler and by identify being a cold, low-volume event; would only matter under call patterns this provider does not currently produce.

### Investigated, no issue

- **Reactive-ref re-eval (primary hint):** `bootstrapSyftClient()` reads `remoteConfig.value.syftdata_source_id` outside any `computed`/`watch`/render effect. Vue only registers dependencies inside an active reactive effect, so this plain read triggers no subscription and no re-evaluation. No reactivity perf issue. (High confidence.)
- **Repeated work in a hot path:** `bootstrapSyftClient()` is reached only from the constructor and `identifyUser()` (called by `trackAuth`/`trackUserLoggedIn`) — all auth-lifecycle events (login/signup/session-restore), not render/loop hot paths. Per-call re-run of bootstrap (including a fresh `window.syftc = { sourceId }` allocation and short-circuit branch) is trivial at this frequency. No finding.
- **Script-injection dedupe:** `createScriptLoader` (`src/utils/loadExternalScript.ts`, pre-existing, not in this diff) caches the in-flight promise, checks `document.querySelector('script[src="..."]')` for an existing tag, and `getReady()` checks `window.syft`. The provider additionally guards with `if (window.syft) return window.syft`. One injection per `SYFT_SRC`; the GTM-preloaded-client test confirms no injection when a real client exists. No duplicate-network-load risk. No finding.
- **Bundle size:** `SyftTelemetryProvider` is dynamically `import()`-ed inside `initTelemetry`'s `Promise.all` (cloud-only, lazy). The Syft SDK is loaded at runtime via script injection, not bundled. All static imports (`normalizeEmail`, `remoteConfig`, `useCurrentUser`, `createScriptLoader`) are tiny/shared. No eager heavy import. No finding.
- **normalizeEmail cost:** `email?.trim().toLowerCase() || null` — no regex, two string allocations, invoked only on cold auth events. Negligible. No finding.

### Blind spots
- Did not verify the real Syft `syft.umd.js` SDK actually drains `window.syft.q`/`fi` on load (external third-party script) — [m2]'s residual case depends on it.
- Did not measure real-world Syft SDK download/parse/exec size to quantify [m1]'s cost; severity assumes a typical analytics SDK (tens–low-hundreds of KB).
- `loadExternalScript.ts` polling/timeout behavior is pre-existing and out of this PR's diff; reviewed only for correctness of dedupe, not audited as new code.
