## Agent: architecture-reviewer

### Findings

#### [M1] Reuse of GTM's `window.syft` client is a hidden cross-surface coupling with no in-code contract
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:14-15,52-75`
- **Severity:** major
- **Category:** architecture
- **Description:** The "reuse an already-loaded GTM Syft client" path couples this provider to a Syft tag that **does not exist anywhere in this repo** — `GtmTelemetryProvider.ts` has zero `syft` references (verified), so the GTM-side Syft client is injected at runtime by the GTM tag-manager container config, which lives outside the codebase. The entire contract between the two surfaces is the untyped `window.syft` / `window.syftc` globals plus the exact stub protocol (`q` as `[method, ...args]`, `fi`, `fetchID`) that `createSyftStub()` replicates. Nothing in the repo pins the GTM container to the same SDK version/URL this provider loads (`cdn.sy-d.io/syftnext/syft.umd.js`). If GTM's container swaps the Syft version, changes the queue-drain contract, or loads from a different URL, `bootstrapSyftClient()` will silently adopt an incompatible client (`if (window.syft) return window.syft`) and `identify` calls may be dropped or replayed wrong — a failure invisible to typecheck, lint, and this repo's tests. This is the classic "don't own the thing you're stubbing" leak, and because the other half of the coupling is out-of-repo, it will rot without any local signal.
- **Suggestion:** Is it worth adding a runtime shape/version guard (e.g. assert the reused client exposes the expected methods before adopting it) and a single documented owner of the `window.syft` contract (a typed adapter module both surfaces import), so the coupling is explicit rather than "whatever the GTM container happened to inject"? At minimum, capture the GTM-container dependency in a code comment near the `window.syft` reuse so the next maintainer knows the other half exists.
- **Confidence:** Medium — the leak is real and structural, but severity depends on GTM-container behavior I cannot see from the repo.

#### [m1] Module-level mutable state diverges from the sibling-provider instance-field pattern
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:11-12,68-70,101-102`
- **Severity:** minor
- **Category:** architecture
- **Description:** `currentStub` and `lastIdentifiedEmail` are module-level `let` bindings shared across every `SyftTelemetryProvider` instance, whereas `GtmTelemetryProvider` (`private initialized`) and `ImpactTelemetryProvider` (`private stores`, `private initialized`) keep all state in instance fields. This breaks abstraction consistency across the three cloud providers and violates the repo's "avoid mutable state / minimize module surface" guidance. Concrete cost: the dedupe key `lastIdentifiedEmail` and the recovery flag `currentStub` outlive any single instance, so a second `initTelemetry()` (hot-reload, re-init, or a future multi-registry scenario) would construct a new provider that inherits a stale `lastIdentifiedEmail` and could suppress a legitimate `identify`, or inherit a `currentStub` pointer that no longer matches `window.syft`. The `createScriptLoader` singleton forces `currentStub` to module scope, but `lastIdentifiedEmail` (pure dedupe) has no such reason to be global.
- **Suggestion:** Would moving `lastIdentifiedEmail` (and ideally the identify/dedupe logic) onto the class as an instance field, matching GTM/Impact, remove the cross-instance staleness risk and restore a single consistent provider shape?
- **Confidence:** Medium — divergence is factual; the multi-init bug is edge-case but plausible.

#### [m2] "Temporary rollout" dual-loader state is undocumented in code
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:9-15`
- **Severity:** minor
- **Category:** architecture
- **Description:** The PR body states the long-term cleanup is "one loader path per surface," i.e. this provider's own `loadSyftSdk` is meant to be temporary while it coexists with the GTM-injected loader. But that intent lives only in the PR description; once merged, nothing in the source marks the second loader path or the `window.syft !== currentStub` reuse check as transitional. DRY is knowingly deferred here, which is defensible for a rollout — but an undocumented deferred-duplication tends to become permanent because the next maintainer has no signal that consolidation is expected. The duplication is otherwise well-contained (the reuse guard is a single expression), so this is about discoverability, not code volume.
- **Suggestion:** Add a short comment (or a linked cleanup ticket reference) at the `loadSyftSdk`/reuse guard noting it exists only during GTM-container coexistence, so the "one loader per surface" cleanup isn't lost.
- **Confidence:** Medium — low-cost, but the "temporary becomes permanent" failure mode is common.

#### [m3] Provider owns the full vendor SDK bootstrap protocol, not just telemetry
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:25-50,52-75`
- **Severity:** minor
- **Category:** architecture
- **Description:** Beyond identify + dedupe (its telemetry job), the provider also owns config reading (`remoteConfig.value.syftdata_source_id`), global installation (`window.syftc`, `window.syft`), a hand-rolled replica of the Syft SDK queue stub (`q`/`fi`/`fetchID`/`signup`/`track`/`page`, of which only `identify` is ever used by this provider), and SDK load-failure recovery. That is the Syft SDK's bootstrap responsibility living inside a telemetry provider — a single-responsibility stretch that mirrors the M1 leak (the provider is authoritative for a contract the vendor defines). The unused `signup`/`track`/`page`/`fetchID` surface exists only to stay a faithful drop-in for other callers of the shared global, which is exactly why this bootstrap concern is arguably a separate module from the provider.
- **Suggestion:** Would extracting the stub + bootstrap (`createSyftStub`, `bootstrapSyftClient`, the loader) into a dedicated `syftClient.ts` adapter — leaving the provider to just call `identify` — both tighten SRP and give the M1 contract a single named home? Only worth it if the rollout-duplication is expected to persist; otherwise fold into the M2 cleanup.
- **Confidence:** Medium — decomposition is already decent; this is a boundary-placement judgment, not a defect.

### Blind spots
- Cannot inspect the GTM tag-manager container config (out-of-repo), so I cannot confirm whether GTM loads the same Syft SDK version/URL this provider expects — the crux of M1.
- Cannot verify the real Syft SDK's actual queue-draining contract against `createSyftStub`'s `[method, ...args]` / `fi` shape; fidelity is assumed from the stub code, not vendor docs.
- Assumed `initTelemetry()` runs once per session (single `main.ts` await); the m1 multi-init staleness cost scales with how true that is.
