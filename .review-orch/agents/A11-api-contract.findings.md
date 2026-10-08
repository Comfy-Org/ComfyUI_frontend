## Agent: api-contract

### Findings

#### [M1] Global `SyftDataClient` asserts an object-with-methods shape that the GTM-loaded client may not match
- **File:** `global.d.ts:52-60`, `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:481`
- **Severity:** major
- **Category:** architecture
- **Description:** `window.syft` is declared as `SyftDataClient` — an object exposing `identify()/signup()/track()/page()` methods. The provider trusts this: `bootstrapSyftClient()` returns `window.syft` when present (the "already-loaded GTM Syft client") and `identifyUser()` then calls `syft.identify(email, traits)`. Analytics vendor snippets very commonly install their global as a **callable queue stub** (`syft('identify', …)` with a `.q` array), not an object with named methods. If the external GTM Syft tag installs a function-style stub, `window.syft.identify` is `undefined` at runtime → `TypeError: syft.identify is not a function`. The hand-declared global gives false type safety: TS asserts `.identify` exists, so the mismatch is invisible until it breaks in the browser. Who breaks: Cloud auth users during rollout when GTM loaded first with a different stub shape; the identify handoff throws and the sign_up/login enrichment is lost.
- **Suggestion:** Confirm the real GTM Syft snippet's global shape (object-with-methods vs callable stub) and align the declared type. If the vendor uses a callable stub, model `syft` as `((method: string, ...args) => void) & { q?: … }` and dispatch via `window.syft('identify', email, traits)` instead of `.identify(...)`. At minimum add a runtime `typeof syft.identify === 'function'` guard before calling.
- **Confidence:** Medium — call shape is internally consistent with the declaration, but the declaration itself is unverifiable against the external SDK (blind spot: I cannot see the GTM Syft tag source).

#### [M2] `window.syftc` is written with a `{ sourceId }`-only shape that may clobber / conflict with the GTM tag's config global
- **File:** `global.d.ts:100`, `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:456`
- **Severity:** major
- **Category:** architecture
- **Description:** `bootstrapSyftClient()` unconditionally does `window.syftc = { sourceId }`, and the global is declared as exactly `{ sourceId: string }`. During rollout two loaders coexist (GTM Syft tag + this provider). If the GTM tag also initializes `window.syftc` as its own config object (a plausible name for "syft config") with additional fields, this provider overwrites it with an object carrying only `sourceId`, dropping any other config the tag set — or vice-versa. Two loaders declaring/writing the same global with different shapes is the classic dual-loader hazard the PR explicitly flags. Who breaks: whichever loader reads `syftc` expecting its own richer shape gets a truncated object; source attribution or SDK init on the GTM side could silently misbehave.
- **Suggestion:** Verify what the GTM Syft tag writes to `window.syftc`. If it owns that global, merge rather than replace (`window.syftc = { ...window.syftc, sourceId }`) and widen the declared type to match the real config shape. If it does not use `syftc`, document that this provider is the sole owner.
- **Confidence:** Medium — conflict is conditional on the GTM tag using the same `syftc` global (blind spot: GTM tag not in repo).

#### [m1] Stub `q` queue format is an unverified contract with the real Syft SDK; two-loader race can drop queued events
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:429-449,463-473`
- **Severity:** minor
- **Category:** architecture
- **Description:** The stub queues calls as `q.push([method, ...args])` (e.g. `['identify', email, { source, method }]`) expecting the real SDK, once loaded, to drain `window.syft.q` in that exact positional format. This is an implicit contract with the external SDK's replay logic that cannot be verified here. Additionally, if this provider installs its stub first and the GTM tag later overwrites `window.syft` with its own stub, entries already pushed to this provider's `q` are orphaned and never replayed (the failure-eviction guard `window.syft === stub` then correctly declines to evict, but the queued identify is silently lost). Who breaks: users identified in the brief window before the GTM tag swaps the global.
- **Suggestion:** Confirm the SDK's expected queue element format matches `[method, ...args]`. Consider having the provider reuse the GTM stub's queue when one already exists rather than racing to install its own.
- **Confidence:** Medium — depends on external SDK replay semantics and loader timing (blind spot).

#### [m2] `SyftDataTraits` omits `boolean` (and arrays/objects), narrower than typical identify traits
- **File:** `global.d.ts:44`
- **Severity:** minor
- **Category:** architecture
- **Description:** `type SyftDataTraits = Record<string, string | number | null | undefined>`. Current usage (`{ source, method }`) is all-string so it compiles, but analytics identify traits normally allow `boolean` and nested values. Any future caller passing a boolean trait (e.g. `is_new_user`) will fail to typecheck against the vendor's actual accepted shape. Who breaks: the next developer extending traits, forced to widen this ad-hoc.
- **Suggestion:** If the SDK accepts booleans, add `| boolean` to the union (matching how other value maps in this file are typed). Otherwise leave a note that the narrowness is intentional.
- **Confidence:** Low — cannot confirm the SDK's accepted trait value types (blind spot); non-blocking for current call sites.

#### [N1] Declared/stubbed `signup()` and `track()`/`page()` methods are unused surface
- **File:** `global.d.ts:53-56`, `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:441-448`
- **Severity:** nitpick
- **Category:** architecture
- **Description:** The provider identifies new users via `identify(email, { source: 'signup' })` (the documented Syft handoff), never calling the declared `signup()` method; `track()` and `page()` are likewise declared and stubbed but unused. This is extra API surface asserting SDK methods exist without exercising them, and it invites confusion about which handoff (`identify` vs `signup`) is canonical.
- **Suggestion:** Keep only what the stub/replay contract actually requires, or add a comment tying `signup`/`track`/`page` to the real SDK methods they mirror. No behavior change.
- **Confidence:** High — direct read of the diff.

### Non-issues verified
- `RemoteConfig.syftdata_source_id?` is optional and config is an untyped reactive `ref<RemoteConfig>({})` with no runtime schema validation — additive, backward compatible, cannot break existing config parsing.
- `AuthMethod` extraction (`method?: 'email'|'google'|'github'` → `method?: AuthMethod`) is the same union, merely named+exported — no breaking change to `AuthMetadata` consumers.
- `TelemetryProvider` methods are all optional; implementing only `trackAuth`/`trackUserLoggedIn` with matching signatures (`trackAuth(metadata: AuthMetadata): void`, `trackUserLoggedIn(): void`) is consistent with GTM/Impact providers.

### Blind spots
- The external GTM Syft tag source (global name, stub shape function-vs-object, `syftc` shape, queue-replay format) is not in the repo — M1, M2, m1 all hinge on it.
- The real Syft SDK's `identify(email, traits)` positional contract and accepted trait value types are unverifiable from this diff.
