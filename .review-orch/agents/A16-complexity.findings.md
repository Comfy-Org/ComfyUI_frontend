## Agent: complexity

### Findings

#### [m1] Load/failed/retry state machine is spread across five uncoordinated mutable locations
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:10-74`
- **Severity:** minor
- **Category:** dx
- **Description:** The lifecycle (no-config / stub-installed / load-in-flight / real-client-loaded / failed / retry) is not modeled anywhere as one structure. Its state is implied by the interaction of five independently-mutated cells: module `currentStub`, module `lastIdentifiedEmail`, the loader-internal `scriptPromise` (inside `createScriptLoader`), `window.syft`, and `window.syftc`. Correct retry after a failure requires that *three* of these reset in lockstep across a module boundary: the loader must null its own `scriptPromise` (so `loadSyftSdk()` starts a new load) while `bootstrapSyftClient`'s catch handler independently nulls `currentStub` and deletes `window.syft`. Nothing enforces that these two resets agree. If a future change to `loadExternalScript` stops nulling `scriptPromise` on reject (or `bootstrapSyftClient`'s guard `window.syft === stub` fails to fire because another loader mutated `window.syft`), you get a wedged state — a stub stuck in `window.syft` that never retries, or a resolved-but-stale promise — with no single place to inspect why. Why is the retry contract split between the provider's catch block and the loader's internal `scriptPromise = null`, rather than expressed in one owner?
- **Suggestion:** Consider consolidating the SDK-load state into the loader (have it own stub install + eviction-on-failure) so the provider only asks "give me a client or null," or at minimum document the reset contract at the `loadSyftSdk` call site so the cross-module coupling is visible. A single `type SyftState = 'idle' | 'loading' | 'ready' | 'failed'` would make the retry path auditable.
- **Confidence:** Medium — the current tests exercise the happy retry path, but the coordination is implicit and one-line changes in either module can silently break it.

#### [m2] `bootstrapSyftClient` mixes config read, global install, client reuse, async load, and identify-dedup reset
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:51-74`
- **Severity:** minor
- **Category:** dx
- **Description:** One function does five unrelated things: reads `remoteConfig.syftdata_source_id`, writes `window.syftc`, decides stub-vs-existing-client reuse, kicks off the async loader, and — inside the failure callback — resets `lastIdentifiedEmail`, which is an *identify-dedup* concern owned by `trackUserLoggedIn`/`identifyUser`, not by bootstrap. It is also called for two different reasons: as a fire-and-forget side effect in the constructor, and as a value-returning "get me a client" call from `identifyUser`. A reader has to hold all of that at once to know whether a given call mutates dedup state. Why does the loader-failure handler reach into `lastIdentifiedEmail`?
- **Suggestion:** Split "ensure client is bootstrapping" (side-effecting, returns client-or-null) from the dedup reset. Let `identifyUser` own `lastIdentifiedEmail` entirely (set on success, cleared when it observes the client went away), so bootstrap stays a pure loader/reuse decision.
- **Confidence:** Medium — behavior is correct today; this is about the reset living in a surprising place, which is where a future edit is likely to drop or double it.

#### [m3] Non-obvious construction-vs-identify ordering for the reactive source id
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:51-56, 85-87`
- **Severity:** nitpick
- **Category:** dx
- **Description:** The constructor calls `bootstrapSyftClient`, which early-returns `window.syft ?? null` (installing no stub, writing no `syftc`) when `syftdata_source_id` is absent at construction time. Later `identify*` calls re-read `remoteConfig.value` and can then install the stub. So whether construction "does anything" depends on load ordering of `refreshRemoteConfig` vs `initTelemetry` — a dependency that is real and intentional (per context.md) but invisible at the call site. A reader seeing `constructor() { bootstrapSyftClient() }` cannot tell that construction may be a no-op that a later identify recovers from.
- **Suggestion:** A one-line comment at the constructor noting "source id may not be present yet; a later identify re-reads remoteConfig reactively" would remove the trap without adding structure.
- **Confidence:** High — this is documented as intended; the note is purely a readability nitpick.

### Blind spots
- I judged control flow statically; I did not run the test suite or step through the async race between `load`/`error`/poll/timeout in `loadExternalScript`.
- I did not audit `createScriptLoader`'s own internal complexity beyond its retry/`scriptPromise`-reset contract as it bears on the provider.
- I took `remoteConfig` reactivity and the `main.ts` await-ordering claim from context.md on faith.
