## Agent: vue-patterns

### Findings

Reactivity assessment of the `remoteConfig` ref usage in `SyftTelemetryProvider.ts`. The claimed behavior ("constructor reads only the remoteConfig ref, later authenticated refresh picked up on next call, no Pinia/current-user at construction") holds. Details below, then one low-value nitpick.

#### Verification (no bug) — remoteConfig read observes updates correctly
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:452-453`
- **Severity:** —
- **Category:** logic
- **Description:** `bootstrapSyftClient()` reads `remoteConfig.value.syftdata_source_id` fresh on every invocation. `remoteConfig` is imported as the module-singleton `ref<RemoteConfig>({})` (`src/platform/remoteConfig/remoteConfig.ts:47`), and `refreshRemoteConfig` mutates it via whole-object replacement `remoteConfig.value = config` (`src/platform/remoteConfig/refreshRemoteConfig.ts:42`). Because `.value` is dereferenced at call time (not destructured/captured into a local at module or constructor scope), a later authenticated refresh IS observed on the next `trackAuth()` / `trackUserLoggedIn()` → `identifyUser()` → `bootstrapSyftClient()` call. Scenario "authenticated config sets syftdata_source_id after construction; first auth event then bootstraps the SDK" works. No reactivity-loss-via-destructuring anywhere in the module. No `.value` mistakes on either ref (`remoteConfig.value`, `useCurrentUser().userEmail.value` both correct).
- **Suggestion:** None.
- **Confidence:** High — traced the ref source, the mutation site (whole-object replace), and every read site.

#### Verification (no bug) — no Pinia / current-user access at construction
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:486-488`
- **Severity:** —
- **Category:** logic
- **Description:** The constructor only calls `bootstrapSyftClient()`, which touches `remoteConfig.value` and `window.syft`/`window.syftc` — no store access. `useCurrentUser()` (which internally instantiates `useAuthStore()`, `useCommandStore()`, `useApiKeyAuthStore()` — see `src/composables/auth/useCurrentUser.ts:9-12`) is invoked only inside `trackUserLoggedIn()` (line 501), i.e. after app/auth setup. FE-945 is not reintroduced. This is corroborated by the test "does not touch the current user store during construction".
- **Suggestion:** None.
- **Confidence:** High — confirmed `useCurrentUser` is the Pinia entry point and it is absent from the constructor path.

#### [m1] "Reactively" is a lazy re-read on call, not a Vue watcher — wording only
- **File:** `.review-orch/context.md` (PR description) / `SyftTelemetryProvider.ts:452`
- **Severity:** nitpick
- **Category:** logic
- **Description:** The PR says the later refresh is "picked up reactively." There is no `watch`/`watchEffect`/`computed` and no reactive effect here — the ref is simply dereferenced imperatively on each call. This is actually the correct, robust choice for a non-component module (a real watcher would add a subscription/flush-timing surface with no benefit, since bootstrap only needs the current value at each auth event). Flagging only because "reactively" could mislead a future maintainer into assuming an effect fires on refresh — it does not; nothing happens until the next `trackAuth`/`trackUserLoggedIn`. If no auth event ever follows the authenticated refresh, the SDK is never loaded (intended: identify is auth-triggered).
- **Suggestion:** Optionally reword to "re-read on the next auth call" in the PR/any code comment; no code change needed.
- **Confidence:** Medium — behavior is correct; this is purely about the "reactive" framing.

### Blind spots
- This is not a `.vue` SFC; no template/computed/watchEffect flush-timing concerns apply, and none were introduced.
- Module-level mutable singletons (`currentStub`, `lastIdentifiedEmail`) and the SDK-loader idempotency/retry are logic/lifecycle concerns outside the Vue-reactivity remit — deferred to logic/telemetry reviewers.
- Did not assess whether `syftdata_source_id` is actually present in the anonymous vs authenticated config payload server-side; assumed the PR's claim that it may only arrive with the authenticated refresh.
