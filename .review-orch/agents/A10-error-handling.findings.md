## Agent: error-handling

### Findings

#### [M1] Dedup against a stub-queued identify that later fails-to-load can drop the identify entirely
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:76-103`
- **Severity:** major
- **Category:** logic
- **Description:** `identifyUser()` sets `lastIdentifiedEmail = email` *synchronously* the moment it enqueues `identify` onto the stub — before the SDK has actually loaded. The load can fail up to 10s later (script `error` or the 10s timeout in `createScriptLoader`). The failure `.catch` resets `lastIdentifiedEmail = null` so a *later* call can retry — but the design's only retry caller, `GraphView.vue:296-302` `trackUserLoggedIn()`, is one-shot (guarded by `hasTrackedLogin`). Failure scenario: user signs up → `trackAuth` enqueues `identify(email, {source:'signup'})` onto the stub and sets `lastIdentifiedEmail=email`; graph becomes ready and `trackUserLoggedIn()` fires while the load is still in flight → `normalizedEmail === lastIdentifiedEmail` → **deduped/skipped** and `hasTrackedLogin=true`; then the SDK load fails → stub (with its queued identify) is discarded and `lastIdentifiedEmail` reset, but nothing ever calls `trackUserLoggedIn` again. Net result: the user is **never identified to Syft** for that session — the exact outcome this PR exists to prevent — with only a generic `[Syft] SDK failed to load` console.warn (the identify loss itself is silent).
- **Suggestion:** Don't treat "queued to stub" as "identified." Either (a) set `lastIdentifiedEmail` only after the load promise resolves successfully, or (b) on load failure re-drive the pending identify from the retained metadata rather than relying on an external one-shot caller, or (c) have the failure `.catch` reset `hasTrackedLogin`-equivalent state. At minimum, key dedup on successful delivery, not on enqueue.
- **Confidence:** High — mechanism verified: `lastIdentifiedEmail` set at enqueue (line 81), reset only in the async catch (line 65), and `trackUserLoggedIn` is one-shot (`GraphView.vue:301`). Exact race depends on load-failure timing vs graph-ready, but the 10s timeout window makes the overlap easily reachable.

#### [M2] Signup attribution silently downgraded to `login` after an SDK load failure
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:62-71, 89-104`
- **Severity:** major
- **Category:** logic
- **Description:** `trackAuth` is the only path that emits `source:'signup'`, and it fires exactly once at the auth moment. If the SDK load fails asynchronously after the signup identify was queued, the stub (holding the `signup`-source identify) is discarded and `lastIdentifiedEmail` reset. The only later retry path is `trackUserLoggedIn()`, which always sends `createTraits('login')`. So a user who signs up during a Syft/CDN outage is, at best, recorded with `source:'login'` and never `signup` — permanent attribution loss for that user (a returning-user login later also yields `login`). Logged only as a generic load-failure warning; the attribution downgrade itself is silent.
- **Suggestion:** Persist the pending identify's traits (including `source:'signup'`) and replay those exact traits on retry instead of hardcoding `login` in the retry path.
- **Confidence:** High on mechanism; Medium on business severity — depends on how much signup-vs-login attribution matters downstream.

#### [m1] `fetchID` stub promises never settle when the stub is evicted on load failure
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:34-38, 62-71`
- **Severity:** minor
- **Category:** logic
- **Description:** `createSyftStub().fetchID()` returns a Promise whose resolve/reject are stored in `fi` and only ever settled by the real SDK draining that array. On load failure the stub is deleted (`delete window.syft`) and `fi` is abandoned — any awaiter of `window.syft.fetchID(...)` hangs forever (no timeout, no rejection). No caller invokes `fetchID` in this PR, so it's latent, but it's an unhandled-promise trap the moment anything awaits the queued fetch before load completes.
- **Suggestion:** On load-failure eviction, reject all pending `fi` entries (e.g., `fi.forEach(p => p.reject(error))`), or give `fetchID`'s promise its own timeout.
- **Confidence:** High that the promises are abandoned; Low on current impact since `fetchID` is unused.

#### [m2] No backoff on retry; each post-failure identify injects a fresh script tag
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:58-73`
- **Severity:** minor
- **Category:** logic
- **Description:** After a failure, `scriptPromise` is nulled and `window.syft` deleted, so the next `identifyUser` creates a new stub and appends a new `<script>` with no backoff or attempt cap. Concurrent calls coalesce (window.syft stays truthy while in-flight), so this is serialized rather than a storm, but a persistent CDN outage combined with repeated identify calls yields repeated fresh script injections. Given the current call sites fire ~twice per session this is low-risk today, but there is no guard if call frequency grows.
- **Suggestion:** Add a small attempt cap or backoff timestamp before re-appending the script.
- **Confidence:** Medium — low real-world impact given current call frequency.

### Notes / positives (not defects)
- The stub-eviction identity guards are sound: `if (window.syft === stub)` and `if (currentStub === stub)` correctly prevent evicting a real client another loader installed, and prevent nulling a newer stub. I could not construct a "permanently poisoned stub" or "evict-a-good-client" scenario — on timeout/error the stub is cleared and a later call can create a fresh one; `getReady`'s `window.syft !== currentStub` check correctly distinguishes the real client from the stub. The 10s timeout in `createScriptLoader` covers the network-hang case (onerror alone would not).
- Construction is non-blocking as required by FE-945: `loadSyftSdk()`'s synchronous DOM work runs inside a Promise executor, so any throw becomes a rejection handled by the `.catch`, not a constructor throw. `remoteConfig.value` defaults to `{}` so the source-id read can't throw.
- The registry wraps `trackAuth`/`trackUserLoggedIn` in try/catch → `console.error` (`TelemetryRegistry.ts:57-65`), so a synchronous throw from the real `syft.identify` is contained.

### Blind spots
- The real Syft SDK's queue-replay contract is out of scope: whether it drains the *previous* `window.syft.q` on load (vs clobbering) determines if events queued to a stub survive a successful late load. If it clobbers, additional events beyond the identify may be lost. Not verifiable from this repo.
- `new SyftTelemetryProvider()` in `initTelemetry.ts:49` is not individually try/caught; a synchronous constructor throw would abort registration of all providers registered after it and skip `setTelemetryRegistry`. Verified the constructor does not throw synchronously today, but this is a shared fragility of the init sequence, not specific to this PR.
- Exact win of the M1 race (load-failure vs graph-ready-idle ordering) depends on runtime timing I could not measure; I reasoned from the 10s timeout window and the one-shot `hasTrackedLogin` guard.

A10: 0C 2M 2m 0N
Findings: .review-orch/agents/A10-error-handling.findings.md
Status: DONE
