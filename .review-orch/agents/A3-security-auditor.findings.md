## Agent: security-auditor

### Findings

#### [M1] Third-party analytics SDK injected with no Subresource Integrity or crossorigin
- **File:** `src/utils/loadExternalScript.ts:64-105` (invoked from `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:9,414`)
- **Severity:** major
- **Category:** security
- **Description:** `createScriptLoader` builds a `<script>` whose `src` is set to `SYFT_SRC = https://cdn.sy-d.io/syftnext/syft.umd.js` and appends it to `document.head` with only `async = true` — no `integrity` (SRI) hash and no `crossorigin` attribute. The loaded script runs with full privileges in the authenticated Cloud app context. If `cdn.sy-d.io` is compromised (CDN breach, DNS hijack, or a malicious/rotated build served at that stable URL) the attacker gets arbitrary JS execution in every logged-in user's session: it can read the auth store, session tokens, and the plaintext user email this PR queues into the global `window.syft.q`, then exfiltrate to any host. This is a classic supply-chain / dynamic-script-injection exposure. The trust decision is entirely on the vendor's CDN.
- **Suggestion:** Pin an `integrity` hash + `crossorigin="anonymous"` on the injected script if the vendor publishes SRI-stable builds; if the SDK auto-updates (SRI impractical), at minimum document the accepted supply-chain risk, constrain via a CSP `script-src` allowlist for `cdn.sy-d.io`, and confirm the vendor endpoint is HTTPS-pinned. Consider `script-src` + `connect-src` CSP entries covering both `cdn.sy-d.io` and `e2.sy-d.io`.
- **Confidence:** High — the loader code shows no integrity/crossorigin/nonce is ever set (grep confirmed none in the util or telemetry dir).

#### [M2] Raw (unhashed) user email sent to third-party vendor with no visible consent/opt-out gate
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:477-505`
- **Severity:** major
- **Category:** security
- **Description:** `identifyUser` calls `syft.identify(email, traits)` with the plaintext normalized email (from `normalizeEmail`, which only trims + lowercases — no hashing). This plaintext PII is handed to the Syft SDK and, per the PR description, transmitted to `https://e2.sy-d.io/events`. Contrast with the sibling `ImpactTelemetryProvider` (line 122-126) whose spec requires the email be SHA1-hashed before leaving the browser — Syft receives it in the clear. The only gate is the cloud-build flag (`IS_CLOUD_BUILD` in `initTelemetry.ts:19`); a grep for `consent|optOut|doNotTrack|gdpr` across `src/platform/telemetry/` returns nothing, so there is no per-user consent, opt-out, or Do-Not-Track check before PII is exported to the vendor. Any authenticated Cloud user's email is disclosed to a third party purely on session/auth events, with no way for the user to decline. (Note: `GtmTelemetryProvider` already sends a lowercased, unhashed email too, so this is a pre-existing pattern this PR extends to a second vendor — but it broadens PII egress.)
- **Suggestion:** Confirm a consent/DPA basis exists for exporting raw email to Syft; if user consent or opt-out is required, gate `identify` on it (as many analytics stacks gate on a consent flag). If the vendor supports hashed identifiers, prefer sending a hash rather than plaintext. At minimum ensure the privacy policy / data-processing agreement covers `sy-d.io`.
- **Confidence:** Medium — High that raw email is sent and no hashing occurs; Medium on the consent gap because a consent mechanism could live outside the telemetry dir (I did not find one, and the registry dispatch was not exhaustively traced).

#### [m1] Plaintext email retained in a page-global queue readable by any in-page script
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:425-449,481`
- **Severity:** minor
- **Category:** security
- **Description:** The pre-SDK stub pushes `['identify', email, traits]` into `window.syft.q`, an array on the global `window`. Until (or if) the real SDK drains it, the plaintext email sits in a globally reachable structure. ComfyUI runs custom-node / extension JS in the same page context, so a malicious or compromised extension could read `window.syft.q` and harvest the email. Exposure is bounded because the same email is already reachable via the auth store to any in-page script, so this adds a second sink rather than a novel disclosure — hence minor.
- **Suggestion:** Accept as inherent to the queue-stub pattern, or clear/drain `q` promptly once the real client loads. No blocking change required.
- **Confidence:** High on the mechanism; Low that it materially increases attack surface beyond the existing auth store.

#### [N1] Cleared/verified: no XSS via config, error handler does not leak PII
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:52-55,463-472`
- **Severity:** nitpick
- **Category:** security
- **Description:** Positive confirmations (not defects): (1) `syftdata_source_id` from `remoteConfig` is only assigned to the `window.syftc.sourceId` object property — it is never interpolated into a URL, `script.src`, `innerHTML`, or any DOM sink, so it cannot drive script/URL injection even though it is server-supplied. `SYFT_SRC` is a hardcoded module constant, not attacker-influenceable. (2) The load-failure handler logs `console.warn('[Syft] SDK failed to load', error)` — the `error` is the loader's `Error` object (`Script failed to load: <src>`), containing no email or PII. (3) No tokens/keys/source-ids are committed in `global.d.ts` or config types — only type declarations.
- **Suggestion:** None. Recorded so downstream reviewers know these vectors were checked.
- **Confidence:** High.

### Blind spots
- I cannot see the Syft SDK internals (`syft.umd.js`): I cannot confirm what fields it actually transmits, whether it hashes/pseudonymizes email server-side, or whether it drains `window.syft.q` and clears the plaintext. M2's leak assumption (plaintext email reaches `e2.sy-d.io`) rests on the PR description, not on inspected SDK code.
- Consent/opt-out could be enforced at the registry-dispatch layer or in the caller of `trackAuth`/`trackUserLoggedIn`, which I did not fully trace; M2's consent claim is Medium confidence for that reason.
- I did not verify whether a CSP is enforced at the app/server level that would already constrain `script-src`/`connect-src` for `sy-d.io`; if a strict CSP exists, M1's impact is reduced.
