## Agent: regression-risk

### Findings

#### [N1] GTM trackAuth: whitespace-only email now omits user_data instead of sending empty string
- **File:** `src/platform/telemetry/providers/cloud/GtmTelemetryProvider.ts:140-147`
- **Severity:** nitpick
- **Category:** logic
- **Description:** The refactor replaces the raw guard `metadata.email ? { user_data: { email: metadata.email.trim().toLowerCase() } } : {}` with `normalizeEmail(metadata.email) ? { user_data: { email: normalizedEmail } } : {}`. `normalizeEmail` returns `null` for a whitespace-only string (`"  ".trim() === "" || null`), whereas the old truthy check on the raw value passed and emitted `user_data.email = ""`. Net behavioral delta: for a whitespace-only `metadata.email`, GTM now omits `user_data` entirely rather than pushing an empty email. For empty-string and valid emails the behavior is identical (verified: old `""` is falsy → omitted; old valid → same trimmed-lowercase value). This is effectively an improvement (empty emails were never useful) and whitespace-only emails are not a realistic input. GTM does not reference `window.syft` at all (grep: no matches), so this change cannot affect the shared Syft/GTM client — the "shared client reuse" rollout concern does not apply to the modified GTM code.
- **Suggestion:** None required; acceptable as-is.
- **Confidence:** High — behavior traced line-by-line against `git show origin/main`; edge case is theoretical only.

---

### Regression checks that came back CLEAN (no issue)

- **FE-945 startup-blocker NOT re-introduced.** `initTelemetry.ts` change (`initTelemetry.ts:29,39,49`) is purely additive: it adds the `SyftTelemetryProvider` dynamic import and `registry.registerProvider(new SyftTelemetryProvider())`. No reordering of any existing provider or of the `refreshRemoteConfig` → `initTelemetry` sequence. `main.ts` (which owns that ordering) is **not modified by this PR** — `git diff <merge-base 55c52a730>..HEAD -- src/main.ts` is empty; the apparent main.ts delta vs `origin/main` is merge skew (branch lags `origin/main`). At the merge-base, ordering is intact: `refreshRemoteConfig({useAuth:false})` runs (gated `isCloud || hasHostTelemetryBridge`) before the cloud-only `initTelemetry()`, so the Syft source id is present when the new provider's constructor reads it. Confidence: High.

- **New provider constructor is Pinia/current-user-free** (the specific FE-945 invariant). `SyftTelemetryProvider` constructor calls only `bootstrapSyftClient()`, which reads `remoteConfig.value.syftdata_source_id` (a plain reactive ref from `@/platform/remoteConfig/remoteConfig`, not a Pinia store) and touches `window.syft/syftc`. `useCurrentUser()` is invoked only inside `trackUserLoggedIn()`, after setup. Guarded by the test `does not touch the current user store during construction`. Confidence: High.

- **Shared type changes are additive/safe.** `telemetry/types.ts`: `AuthMethod` is extracted as a named alias for the pre-existing inline union `'email' | 'google' | 'github'` — identical membership, and `grep` finds no consumers of `AuthMethod` outside the type file and the new Syft provider, so no downstream break. `remoteConfig/types.ts`: adds optional `syftdata_source_id?: string` — additive optional field, cannot break existing `RemoteConfig` consumers. Confidence: High.

- **ImpactTelemetryProvider behavior unchanged.** `customerEmail.trim().toLowerCase()` → `normalizeEmail(customerEmail)` (`ImpactTelemetryProvider.ts:89`). `resolveCustomerIdentity()` always returns a `string` (`EMPTY_CUSTOMER_VALUE = ''`), so old path: `'' → ''` (falsy → `hashedEmail = EMPTY_CUSTOMER_VALUE`); new path: `'' → null` (falsy → same). Valid emails hash identically. No SHA1/identify payload change. Confidence: High.

### Blind spots
- Post-rebase onto current `origin/main`, `refreshRemoteConfig` becomes conditional (`isCloud || hasHostTelemetryBridge`). Since `initTelemetry` (and thus Syft construction) is already cloud-only and `refreshRemoteConfig` runs whenever `isCloud`, ordering remains correct after rebase — but I verified this on the current tree, not on a materialized rebase.
- The net-new `SyftTelemetryProvider.ts` loader/stub/retry logic is out of scope for regression assessment (no prior version to regress against); correctness of the script-loader idempotency and stub-eviction guard should be covered by the logic/correctness reviewer.
