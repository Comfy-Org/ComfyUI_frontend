## Agent: test-quality

### Findings

#### [M1] Identity-guard branch on load failure is never exercised
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.test.ts:84-140`
- **Severity:** major
- **Category:** test
- **Description:** The failure catch in `bootstrapSyftClient` (impl lines 62-71) is guarded by `if (window.syft === stub)` / `if (currentStub === stub)` — the PR review focus explicitly calls this out: "guarded by an identity check so it never evicts a real client another loader installed." Both failure tests ("clears the stub…" and "re-identifies via trackUserLoggedIn…") dispatch `error` while `window.syft` still equals the failing stub, so they only cover the `=== stub` branch. The safety branch — a real client (or another loader's stub) was installed into `window.syft` before this load's catch runs, and the catch must NOT `delete window.syft` / null `lastIdentifiedEmail` — has zero coverage. Deleting the guard and doing an unconditional `delete window.syft` would pass every current test, yet that is exactly the GTM-rollout eviction bug the guard exists to prevent.
- **Suggestion:** Add a test: construct provider (installs stub, load pending) → simulate another loader by setting `window.syft = installSyftSpy()` (a real client) → dispatch `error` on the pending script → assert `window.syft` is still the real spy (NOT deleted) and, after a subsequent `trackUserLoggedIn`, dedupe state (`lastIdentifiedEmail`) was not wrongly cleared.
- **Confidence:** High — guard is impl lines 63/67; no test sets `window.syft` to a non-stub value before dispatching `error`.

#### [M2] Reactive source-id pickup after construction (core FE-945 claim) untested
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.test.ts` (whole file)
- **Severity:** major
- **Category:** test
- **Description:** The PR's load-bearing rationale is: "The source id is present at construction because main.ts awaits the anonymous refreshRemoteConfig before initTelemetry, and a later authenticated refresh is picked up reactively on the next ensureSyftClient() call." Impl re-reads `remoteConfig.value.syftdata_source_id` on every `bootstrapSyftClient()` call (line 52). No test covers the transition: construct with `remoteConfig.value = {}` and no `window.syft` (bootstrap early-returns via `window.syft ?? null`, no `syftc`, no script append) → later set `mockRemoteConfig.value = { syftdata_source_id: 'src-123' }` → call `trackAuth`/`trackUserLoggedIn` and assert the SDK now loads (`appendChild` called, `window.syftc` set) and identify is delivered. If someone cached `sourceId` at construction, no test would catch the regression, defeating the stated fix.
- **Suggestion:** Add a test that constructs with empty `remoteConfig`, asserts no script appended and `window.syftc` undefined, then mutates `mockRemoteConfig.value` to add the source id and verifies the next auth call bootstraps and loads.
- **Confidence:** High — every source-id test sets the id before construction; no test mutates it between construction and first identify.

#### [m1] `trackUserLoggedIn` missing-email early-return untested
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.test.ts:227-241`
- **Severity:** minor
- **Category:** test
- **Description:** `trackAuth` with no email is tested (line 214), but the parallel `trackUserLoggedIn` guard `if (!normalizedEmail …) return` (impl line 101) — i.e. `useCurrentUser().userEmail.value` is `undefined`/blank — is not. This is the session-restore-with-no-user case that runs on every anonymous session start; a regression that identifies with an empty string would go unnoticed.
- **Suggestion:** Add a test with `mockCurrentUser.userEmail.value = undefined`, call `trackUserLoggedIn`, assert `syft.identify`/`window.syft?.q` received nothing.
- **Confidence:** High — no test leaves `userEmail.value` unset while calling `trackUserLoggedIn`.

#### [m2] No-source-id + no-existing-client no-op path untested
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.test.ts:199-225`
- **Severity:** minor
- **Category:** test
- **Description:** Tests without a source id (lines 182, 199, 214, 243) all pre-install `window.syft` via `installSyftSpy`, so `bootstrapSyftClient` returns the existing client. The branch where `sourceId` is falsy AND `window.syft` is absent → `bootstrap` returns `null` → `identifyUser` no-ops without throwing (impl lines 53, 78) is never hit. This is the "cloud provider constructed but Syft not configured and GTM tag absent" case; a change that dereferenced the null client would only surface here.
- **Suggestion:** Add a test with empty `remoteConfig` and `window.syft = undefined`, call `trackAuth` with a valid email, assert it silently no-ops (no throw, no append).
- **Confidence:** Medium — inferred from setup; low real-world frequency but a genuinely unexercised guard.

#### [m3] Change-detector assertion on internal stub default
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.test.ts:80`
- **Severity:** nitpick
- **Category:** test
- **Description:** `expect(window.syft?.q).toEqual([])` asserts the stub's queue is empty immediately after construction — an assertion on a default initial value, which AGENTS.md flags ("Do not write change detector tests e.g. a test that just asserts that the defaults are certain values"). The behavioral assertions in the same test (append called once, `src === SYFT_SRC`, `syftc.sourceId`) already cover the load contract; the empty-queue check adds nothing and would break if the stub pre-seeded a `page` call.
- **Suggestion:** Drop the `.q).toEqual([])` line; keep the append-once / src / syftc assertions.
- **Confidence:** Medium — minor style issue, not a correctness risk.

### Blind spots / checked-and-clear
- **Async flush is sound:** `dispatchEvent(new Event('error'))` + single `await Promise.resolve()` is deterministic — the `error` listener rejects synchronously during dispatch, queuing the `.catch` microtask before the awaited continuation. Not flaky. No finding.
- **`lastIdentifiedEmail = null` reset IS covered** by the "re-identifies via trackUserLoggedIn after SDK load failure" test (same email re-identified after failure would otherwise dedupe) — good coverage, no gap.
- **Not deeply assessed:** concurrent/interleaved `bootstrapSyftClient()` calls (scriptPromise + currentStub interplay under `createScriptLoader`) and dedupe against a *different* email after `trackAuth` (only same-email dedupe at line 243 is tested). Both lower-risk; flagging as blind spots rather than findings.
- **Mocks are legitimate:** `installSyftSpy` and the remoteConfig/useCurrentUser mocks stand in for externally-owned collaborators; assertions run through real provider code, so no "testing the mock" violation.
