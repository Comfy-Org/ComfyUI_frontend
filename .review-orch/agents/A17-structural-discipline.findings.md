## Agent: structural-discipline

### Findings

#### [M1] Loaded-vs-stub discriminated by object identity; a real SDK that drains the stub in place makes "loaded" indistinguishable from "still loading" and the failure path then deletes the real client
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:13-15, 62-71`
- **Severity:** major
- **Category:** architecture
- **Description:** The load-state discriminator is `window.syft && window.syft !== currentStub` (getReady) and, symmetrically, the failure guard is `window.syft === stub`. Both encode the assumption that the real Syft UMD installs a *new* object distinct from our stub. Many vendor snippet loaders (this stub's shape — `q`, `fi`, `fetchID` — matches that family) instead reuse the same global object: they read `window.syft.q`, replay it, and reassign the methods on the *same* reference, preserving identity. If Syft does that, then after a successful load `window.syft === currentStub` stays true forever, so `getReady()` never returns non-null → the loader polls to its 10s timeout → rejects → the `.catch` runs with `window.syft === stub` still true → `delete window.syft` **evicts the now-real, functioning client** and resets `lastIdentifiedEmail`. The next identify installs a fresh stub whose queue the departed real client will never replay, so identify is silently, permanently dropped until reload. Making "loaded" a function of pointer inequality between two mutable globals is the structural root: the two legal terminal states (real-client-ready vs load-failed) become representationally ambiguous.
- **Suggestion:** Don't infer "real client loaded" from object identity. Have the loader resolve on a positive readiness signal the real SDK actually sets (e.g. a `loaded`/version flag the UMD writes, or the `load` event alone for this trusted first-party tag), and make the failure guard delete only when the readiness signal is absent. Alternatively model the state explicitly (see m3) so "failed" cannot alias "still holding our stub."
- **Confidence:** Medium — the catastrophic branch is real and reachable in code; whether it fires depends on Syft UMD's in-place-vs-replace behavior, which I cannot verify from this repo. Blind spot declared.

#### [m2] `window.syftc` is a derived copy of remoteConfig, re-clobbered on every identify and even when reusing GTM's client — drifts from both remoteConfig and the already-loaded client's real source
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:52-56`
- **Severity:** minor
- **Category:** architecture
- **Description:** `window.syftc = { sourceId }` is written on *every* `bootstrapSyftClient()` call (each identify), and it is written *before* the `if (window.syft) return` GTM-reuse branch. Two SSOT problems: (1) if GTM (or any other loader) already set `window.syftc`, this unconditionally overwrites it with this provider's `remoteConfig` value — two writers, last-write-wins, no reconciliation. (2) Once the real client has loaded and captured its source id, later reactive changes to `remoteConfig.value.syftdata_source_id` keep rewriting `window.syftc` but do nothing to the live client, so the global and the client's actual configured source silently diverge. The config exists in three places (remoteConfig ref, window.syftc, the loaded client) with no single owner.
- **Suggestion:** Write `window.syftc` once, at stub-install time only (inside the `!window.syft` branch), and treat `remoteConfig` as the sole owner; do not re-emit it on the reuse path or per identify.
- **Confidence:** Medium — clobber-on-reuse and per-call rewrite are directly in the code; user-visible impact depends on whether GTM/Syft read `syftc` after first load.

#### [m3] Load state is scattered across three representations (`window.syft` tri-state, module `currentStub`, hidden `scriptPromise`) with "failed" aliasing "never started" — a discriminated union would make the illegal combinations unrepresentable
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:10, 51-74`
- **Severity:** minor
- **Category:** architecture
- **Description:** The lifecycle unloaded → loading → loaded → failed is reconstructed at each call site by comparing `window.syft` (undefined | our-stub | foreign/real) against module-level `currentStub`, plus the loader's private `scriptPromise`. "failed" and "never started" collapse to the identical observable (`window.syft` undefined, `currentStub` null) — intended for retry, but it means no code can distinguish "we tried and it broke" from "we haven't tried," and it is what lets M1's timeout path masquerade as a clean retry. Because the state is spread across mutable globals rather than one value, combinations like "currentStub set but window.syft undefined" or "currentStub stale after external replacement" are representable even though they should be illegal.
- **Suggestion:** Would a single module-scoped `type SyftState = { kind: 'idle' } | { kind: 'loading'; stub } | { kind: 'ready'; client } | { kind: 'failed' }` (readiness asserted by the loader, not by pointer identity) collapse currentStub + the identity checks into one source of truth and remove the failed/idle alias?
- **Confidence:** Medium — structural observation is concrete; framed as a refactor question.

#### [m4] All provider state is module-global; the class carries zero instance state, so the `trackUserLoggedIn` dedup (`lastIdentifiedEmail`) leaks across instances (HMR / tests / any second registry)
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:10-11, 84-104`
- **Severity:** minor
- **Category:** architecture
- **Description:** `currentStub` and `lastIdentifiedEmail` live at module scope; `SyftTelemetryProvider` has no instance fields at all — it is a namespace over module singletons whose constructor performs DOM mutation and async I/O. `lastIdentifiedEmail` is the dedup key that decides whether a session-restore `trackUserLoggedIn()` is a real identify or a silent no-op. Because it is global, a newly constructed provider (hot reload, a second `initTelemetry`, or test re-instantiation) inherits a stale `lastIdentifiedEmail` from the prior instance and will silently skip a genuine login for that email. The class contract ("construct me, I track for my lifetime") is dishonest about the fact that its lifetime is actually the module's.
- **Suggestion:** Move `currentStub` and `lastIdentifiedEmail` to instance fields (or make the shared singleton explicit and construct-once), so dedup state is scoped to the provider that owns it and cannot bleed across instances.
- **Confidence:** Medium — leak is certain across instances; prod impact is bounded by the single registration in `initTelemetry`, so the live blast radius is mainly tests/HMR.

### Blind spots
- Cannot verify Syft UMD's actual load semantics (replaces `window.syft` vs mutates in place, and whether it sets any readiness flag). M1 hinges entirely on this; if the SDK always installs a fresh object, M1 downgrades to nitpick.
- No in-repo GTM Syft loader exists yet (`grep` finds no `syft` in `GtmTelemetryProvider.ts`); the "reuse GTM's client" and syftc-clobber (m2) interactions are against a future/external loader I cannot inspect.
- Did not assess whether `remoteConfig.value.syftdata_source_id` can realistically change post-load in this app; m2's drift severity depends on that.
