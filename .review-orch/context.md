feat: identify auth users to Syft by benceruleanlu
## Summary

Identifies Cloud auth users to Syft via the required `identify(email, { source })` handoff so Syft enrichment reliably attaches to signup/login users instead of relying only on GTM page-load capture.

## Changes

- **What**: Adds a cloud-only Syft telemetry provider that reads `syftdata_source_id` from `remoteConfig`, lazy-loads the Syft SDK (reusing an already-loaded GTM Syft client when present), and calls `identify` with `source: 'signup'` or `source: 'login'` on auth and on session restore. `trackUserLoggedIn()` dedupes against the email already handled by `trackAuth()` so a fresh login is not identified twice.
- **Dependencies**: None.

## Review Focus

- Preserves the FE-945 startup-blocker fix: the constructor reads only the `remoteConfig` ref (a plain reactive ref, not Pinia) and never touches current-user state; the user-email lookup happens only in `trackUserLoggedIn()`, after app/auth setup. The source id is present at construction because `main.ts` awaits the anonymous `refreshRemoteConfig` before `initTelemetry`, and a later authenticated refresh is picked up reactively on the next `ensureSyftClient()` call.
- SDK loader is idempotent with the current GTM Syft tag during rollout (one script per `SYFT_SRC`). On load failure it clears its own stub — guarded by an identity check so it never evicts a real client another loader installed — letting a subsequent call retry. Long-term cleanup is to keep one loader path per surface.
- Acceptance should include staging Network verification for `https://e2.sy-d.io/events` payloads containing an `identify` event for Google, GitHub, and email auth.

Linear: GTM-168
