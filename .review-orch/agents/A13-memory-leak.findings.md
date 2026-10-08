## Agent: memory-leak
### Findings

#### [N1] Stale `currentStub` module reference retained for app lifetime after successful SDK load
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:10,59-73`
- **Severity:** nitpick
- **Category:** performance
- **Description:** On the success path, `loadSyftSdk()` resolves and the `.catch` never runs, so `currentStub` is only ever reset to `null` on *failure*. After the real Syft SDK loads and replaces `window.syft`, the module-level `currentStub` still points at the discarded stub object (its `q`/`fi` arrays). This is a single small object retained for the app lifetime — no growth. Behavior is unaffected because `getReady`'s `window.syft !== currentStub` check still resolves correctly (real client wins). Bounded, one-shot.
- **Suggestion:** Optional: null out `currentStub` after `loadSyftSdk()` resolves, or leave as-is (harmless). Not worth churn.
- **Confidence:** High — the retention is real; the impact is a single small object, hence nitpick.

### Non-issues (verified clean)

1. **Script `<script>` injection / handler cleanup — CLEAN.** `createScriptLoader` (`src/utils/loadExternalScript.ts`) attaches `load`/`error` listeners with `{ once: true }` so they self-remove, and calls `scriptEl.remove()` on both the `error` and `timeout` paths. On failure it also nulls the cached `scriptPromise`, so a retry appends a *new* script after the failed one is removed — no accumulation across retries (at most one script tag per `SYFT_SRC` at a time). The pre-existing-script branch (GTM rollout) polls instead of appending, so it is idempotent.

2. **Stub queue `q` — bounded, not unbounded.** On SDK load failure the `.catch` deletes `window.syft` (the stub) and resets `currentStub`/`lastIdentifiedEmail`, discarding the entire stub including its `q`. The next `identifyUser` call builds a fresh stub. The 10s loader timeout guarantees the in-flight load always settles (rejects if it never becomes ready), so `q` can only accumulate events for one ~10s in-flight window between rare auth events — never unbounded. Growth scenario does not materialize.

3. **No reactive watcher leak.** `remoteConfig` is a plain `ref` (confirmed in `remoteConfig.ts`) and is read via a direct `remoteConfig.value.syftdata_source_id` access. No `watch`/`watchEffect`/`computed`/`effect` is created, so there is no reactive subscription to leak.

4. **Timers/intervals — all cleared.** The only timers live in `createScriptLoader`: `setTimeout` is cleared on load/error/success, and the `setInterval` poll self-clears on readiness or is cancelled via `cancelPoll?.()` on timeout. The provider itself creates no timers.

5. **Provider lifecycle / listeners — nothing to dispose.** The provider is a long-lived registry singleton but adds no `addEventListener`/timers of its own, so the absence of a dispose path in the telemetry registry is not a leak here.

### Blind spots
- **`fetchID`/`fi` pending promises:** `createSyftStub` exposes `fetchID`, which pushes `{ resolve, reject }` closures into `fi` and returns a never-resolving Promise until the real SDK drains it. If any external consumer (e.g. the GTM Syft tag) calls `window.syft.fetchID(...)` while the stub is active and the SDK then *fails* to load, those resolve/reject closures + the caller's awaiting Promise leak (the stub is discarded but the returned Promise is held by the caller and never settles). In this diff `fetchID` is never invoked, so I could not confirm a real trigger — out of scope of the changed files. Low confidence; flagged for awareness.
- I assume the real Syft SDK drains `window.syft.q` on init (standard analytics-stub contract); not verifiable from this repo. If it does not, replayed events are the SDK's concern, not a leak in this code.
