## Agent: dx-readability
### Findings

#### [m1] Cryptic Syft protocol globals (`q`, `fi`, `fetchID`, `syftc`) declared with zero documentation
- **File:** `global.d.ts:54-59,100`
- **Severity:** minor
- **Category:** dx
- **Description:** `SyftDataClient.q`, `.fi`, `.fetchID`, and `window.syftc` are the Syft UMD SDK's pre-load command-queue contract: the SDK, when `syft.umd.js` loads, drains `window.syft.q` (queued `identify`/`track`/... calls) and reads `window.syftc.sourceId`. Nothing in the declaration says this. A future maintainer reading `q?: unknown[][]` / `fi?: SyftDataPendingFetch[]` has no signal that these single-letter names are dictated by an external SDK's drain protocol rather than arbitrary internal fields. Concrete risk: someone "cleans up" by renaming `q`→`queue` or dropping the seemingly-unused `fi`/`fetchID`, silently breaking the queue handoff so early `identify` events are lost after the real SDK loads. The stub in `SyftTelemetryProvider.ts:26-40` mirrors these exact names for the same reason, equally undocumented.
- **Suggestion:** Add a one-line comment above the block, e.g. `// Syft UMD SDK pre-load stub contract: SDK drains q (command queue) / fi (fetchID queue) and reads syftc.sourceId on load — names are fixed by the SDK.`
- **Confidence:** High — the names are externally-dictated and non-obvious; the risk of a well-meaning rename is real.

#### [N1] `fetchID` / `fi` stub surface is never invoked anywhere in the repo
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:26,34-43`
- **Severity:** nitpick
- **Category:** dx
- **Description:** The stub builds `fi` and `fetchID`, but no code in this PR (or elsewhere in `src/`, confirmed by grep) ever calls `fetchID` or reads `fi` — the provider only ever enqueues `identify`. If these exist purely to match the SDK's expected shape so it can drain `fi` on load, that intent is invisible; if they are speculative, they are dead surface (YAGNI). Concrete risk: a reader can't tell whether removing them is safe, and a future contributor may add real `fetchID` usage assuming the queue is wired end-to-end when nothing consumes it locally.
- **Suggestion:** Either drop `fetchID`/`fi` if the SDK doesn't require them, or add a short note that they exist solely for the SDK's post-load drain. Frame: is `fi`/`fetchID` load-bearing for the SDK handoff, or removable?
- **Confidence:** Low — plausibly required by the SDK's drain contract, which I can't verify from this repo.

#### [N2] PR/context references `ensureSyftClient()` but the function is named `bootstrapSyftClient()`
- **File:** `src/platform/telemetry/providers/cloud/SyftTelemetryProvider.ts:44` (vs `.review-orch/context.md`)
- **Severity:** nitpick
- **Category:** dx
- **Description:** The review-focus text names the reactive-refresh path `ensureSyftClient()`, but the actual function is `bootstrapSyftClient()` (no `ensureSyftClient` symbol exists in the codebase). Concrete risk: a reviewer or later maintainer greps for `ensureSyftClient` to understand the "picked up reactively on the next call" claim, finds nothing, and mistrusts either the code or the description. Also, `bootstrap` connotes one-time init while the function is actually the idempotent per-call ensure/get path, so the name undersells its role.
- **Suggestion:** Rename `bootstrapSyftClient` → `ensureSyftClient` to match its idempotent get-or-create behavior and the description, or fix the description. Frame: should the function name match the "ensure on next call" semantics the PR describes?
- **Confidence:** Medium — the mismatch is factual; whether to fix name vs. doc is a judgment call.

### Blind spots
- Cannot verify the actual Syft UMD SDK's runtime contract (does it truly drain `q`/`fi` and read `syftc.sourceId`?) — findings m1/N1 assume the standard analytics-stub pattern.
- Did not assess correctness of the dedup / load-failure retry logic (owned by other reviewers); only its readability.
