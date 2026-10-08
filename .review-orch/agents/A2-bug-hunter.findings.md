## Agent: bug-hunter
### Findings

#### [m1] Sticky `lastIdentifiedEmail` suppresses the corrective re-identify when a queued identify is dropped
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:63-65,101`
- **Severity:** minor
- **Category:** logic
- **Description:** `lastIdentifiedEmail` is set synchronously in `identifyUser` (line 81) as soon as the identify is *enqueued* into the stub — before the SDK has actually loaded/flushed. It is only cleared again in the failure handler, and only under the guard `if (window.syft === stub)` (line 63). If our load fails but `window.syft` is no longer our stub (e.g. a competing GTM loader has replaced `window.syft` with its own real client while our load was in flight), the guard is false, so `lastIdentifiedEmail` is NOT reset even though the identify we enqueued into our now-orphaned stub was never delivered (the replacing client only drains its own queue object, not ours). The result: `trackUserLoggedIn()`'s dedupe check `normalizedEmail === lastIdentifiedEmail` (line 101) then short-circuits, and the auth user is silently never identified to Syft. Failure path: our `bootstrapSyftClient` installs the stub and enqueues identify before the GTM Syft snippet defines its own `window.syft`; GTM's real client loads, replacing the reference; our load rejects; guard false; `lastIdentifiedEmail` stays set; the one corrective call (session-restore `trackUserLoggedIn`) is deduped away.
- **Suggestion:** Only set `lastIdentifiedEmail` after the identify is confirmed delivered (chain off the load promise), or clear it in the failure handler unconditionally when the enqueued identify could not have flushed, rather than gating on `window.syft === stub`.
- **Confidence:** Low — depends on the Syft UMD's replace-vs-drain contract for a pre-existing `window.syft` object; cannot verify the SDK internals from this diff.

#### [m2] A successful-but-in-place SDK init is treated as a load timeout, evicting the real client
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:13-15,62-66`
- **Severity:** minor
- **Category:** logic
- **Description:** The loader's readiness probe is `window.syft && window.syft !== currentStub` (line 14). It assumes the real Syft SDK *replaces* `window.syft` with a new object. If instead the SDK augments the existing stub object in place (drains `q`, attaches real methods to the same reference — a common analytics-snippet pattern), then `window.syft === currentStub` remains true forever, `getReady()` never returns non-null, `createScriptLoader` hits its 10s timeout and rejects, and the provider's catch handler (`window.syft === stub` is true) then `delete window.syft` — destroying the fully-initialized real client and resetting state. Net effect: a successful load is discarded and all identify calls silently stop working; the retry re-loads and fails the same way.
- **Suggestion:** Make readiness detection independent of object identity (e.g. probe for a marker the real SDK sets, such as a loaded flag or a non-stub method), rather than `window.syft !== currentStub`.
- **Confidence:** Low — hinges on whether the Syft UMD replaces or mutates the global; standard Segment-style snippets replace, in which case this is fine.

#### [m3] Transient SDK load failure drops the identify with no retry for restore-only sessions
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:62-71`
- **Severity:** minor
- **Category:** logic
- **Description:** The recovery design ("clears its own stub … letting a subsequent call retry") relies on a *later* identify call to re-trigger the load. In the session-restore flow there is exactly one identify call: `GraphView.onGraphReady` fires `trackUserLoggedIn()` once, guarded by `hasTrackedLogin`, and no `trackAuth()` runs (no interactive login). If the Syft CDN load fails transiently during that single call, the enqueued identify is discarded (`delete window.syft`, line 64) and nothing ever calls identify again for that session — so the restored user is never identified even though a retry would have succeeded. The claimed "subsequent call retry" never materializes for this path.
- **Suggestion:** On load failure, schedule a bounded retry of the pending identify (re-invoke the load and re-enqueue) rather than depending on an external subsequent call that may not come.
- **Confidence:** Medium — the single-call restore path is real (GraphView.vue:298-302) and the drop-on-failure behavior is in the code; whether losing telemetry on a CDN blip counts as a defect vs. acceptable degradation is a judgment call.

### Blind spots
- Could not verify the Syft UMD SDK's actual behavior for a pre-existing `window.syft` (replace the reference vs. mutate in place, and whether it replays a foreign stub's `q`). Findings m1 and m2 both hinge on that unknown contract; if the real SDK behaves like the standard Segment snippet (replace reference, replay `_q` off the same object), both reduce to non-issues.
- Did not exercise the true GTM-coexistence rollout race in a browser; reasoning is from code + the standard analytics-snippet pattern.
- No high/critical logic bug found: dedupe operator (`||` / `===`), source selection (`is_new_user ? 'signup' : 'login'`), empty-email guards, and null-safety (`normalizeEmail`, `remoteConfig.value` always an object, optional-method dispatch wrapped in try/catch) all check out. Constructor correctly avoids user-store access (FE-945). Single provider instance, so module-level `currentStub`/`lastIdentifiedEmail` sharing is not a multi-instance race.
