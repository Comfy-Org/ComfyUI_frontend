# Cloud workflow test strategy

Status: proposed runtime corpus for FE-2736. Initial public wire-contract tests
and portable examples are implemented in Cloud commit `4d1c96f1ed`, under
`services/comfy-api/workshop/`. They cover scalar preservation, request/result
shapes, required idempotency headers, declared auth/cache policy, and withholding
unimplemented routes from registration and API publication.

Those checks do not prove runtime authorization, publication/default parity,
media transfer, recovery, cancellation or billing. The matrix below is still the
verification contract for the [architecture](../architecture/workshop-cloud-workflows.md),
not a report of completed runtime or staging coverage.

## Test ownership

Prove each invariant at the lowest level that can observe it. Use actual
PostgreSQL for uniqueness, transactions, leases and migration tests; an in-memory
repository cannot prove crash recovery. Use the production HTTP stack for body
bounds, auth, logging, caching and generated-contract tests. Use small controlled
storage/upstream servers for transport faults. Reserve real staging for Cloud,
storage, identity and billing behavior those doubles cannot prove.

Use table-driven input/type and media-kind cases independently, plus one normal
composition test and explicit race/boundary interactions. Do not cross every
widget type with every network failure. Expected graph values, job counts and
file order must be literal or independently checkable, not calculated by the
same mapper under test. No test sleeps, skipped failures, weakened assertions
or public network traffic in the regular browser suite.

## Reuse points and additions

| Layer             | Existing corpus                                                                                                                                                   | Proposed additions                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Editor            | `src/stores/appModeStore.test.ts`, `src/utils/executionUtil.test.ts`, `executionUtil.stability.test.ts`, `ExecutableNodeDTO.test.ts`, subgraph promotion fixtures | Publication/export behavior beside the new utility; extend existing exporter regressions where semantics are shared                 |
| Authoring browser | `browser_tests/` APP builder, input persistence, save/run persistence, widget values, pruning and media preview suites                                            | One real author-save-export-to-published-form composition case using `comfyPage`                                                    |
| Shared render     | Website `router-render.test.ts`, `workshop-url-upload.test.ts`, parameter/snippet tests                                                                           | Workflow defaults/materialization conformance, URL upload and strict output parsing; protect Router behavior at the shared boundary |
| Website state/UI  | Draft, delivery, session, account and PostHog tests; `apps/website/e2e/workshop*.spec.ts`                                                                         | Pure controller transition tests, narrow component tests, and a few wiring E2Es using `blockExternalMedia`                          |
| comfy-api         | `integration-tests/comfy-api/`, storage grant/signer tests, Router transport/worker tests                                                                         | Workshop HTTP/repository/recovery suites using the existing real-Postgres setup and managed-worker test patterns                    |
| Ingest/Cloud      | Job cancellation, prompt policy, auth/capability and inference input/output tests                                                                                 | Receipt/admission races, M2M isolation, scoped asset staging, selected output manifest and policy parity                            |
| Staging           | Existing Cloud workflow/billing harnesses                                                                                                                         | Explicitly opt-in, bounded-cost workflow acceptance with evidence artifacts                                                         |

Keep one versioned fixture manifest shared by publication and backend contract
tests. Record fixture purpose, authoring/export versions, public/private digests,
literal bindings/defaults/output order, and expected validation errors. Consumer
tests must import the published fixtures rather than manufacture incompatible
lookalikes. Do not copy credentials, signed URLs, private user graphs or large
generated media into the repository.

## Publication and parameter corpus

| ID  | Fixture / behavior                                                                                                                         | Observable proof                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| P01 | Text, number/integer, enum, boolean, image/video/audio control, zero-input APP                                                             | Published form types/order/defaults match authored controls; resulting graph inputs match literal expectations |
| P02 | Nested promotion, two instances of one subgraph, one promoted input feeding multiple nodes                                                 | All intended targets change once; sibling instance and unrelated targets stay fixed                            |
| P03 | Reordered widgets, renamed display labels, escaped names, legacy unique selections                                                         | Identity remains correct without relying on position/label                                                     |
| P04 | Ambiguous legacy selection, missing widget/node, pruned selection, linked/muted/bypassed target, nonserializing/custom unsupported control | Publication fails or explicitly produces browse-only availability; never a reduced runnable form               |
| P05 | Virtual-node expansion and async serializer; editor edit during export                                                                     | UI revision, graph and bindings agree, or export fails; no mixed-revision bundle                               |
| P06 | Multiple selected output nodes, nested producer, several files in one role, mixed modalities                                               | Exact selected order and all expected files; unselected outputs absent                                         |
| P07 | Defaults/example, standard override, workflow override, explicit snapshot                                                                  | Browser/CLI/snippet and server normalized values agree; snapshot-plus-overrides is rejected                    |
| P08 | Missing versus null, false/zero/empty, finite/integer/unsafe numeric boundaries, invalid enum and unknown keys                             | Correct values accepted; invalid values rejected before job admission                                          |
| P09 | Resolution/steps/duration/batch limits and interacting constraints; unexposed field injection                                              | Both sides of each boundary; no mutation of fixed graph inputs                                                 |
| P10 | Same key with random seed intent, fresh key with random intent                                                                             | Retry retains seed/job; fresh logical run can resolve a new seed                                               |
| P11 | Stale public version, altered digest, changed runtime/node schema, unavailable model asset                                                 | Retained compatible version runs or a stable definition error is returned; no silent migration                 |
| P12 | PR #18325 relighting prompt omission, camera custom-control substitution, candidate without APP metadata                                   | Published form follows the reviewed APP revision; prototype field curation cannot silently override it         |

## Admission, ownership and recovery corpus

Use barriers/deferred operations and separate database connections to stop at
specific commit/dispatch boundaries. Assert one public run, at most one Cloud
job, and at most one admission-accounting effect after recovery. Test process
restart with a fresh worker/repository instance; retaining an in-memory fake
does not exercise restart durability.

| ID  | Fault / interaction                                                                                          | Observable proof                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| R01 | Concurrent identical submit, same user/key; changed input/version/workspace                                  | One run/job for identical intent; changed requests are 409, with no second admission                          |
| R02 | Token renewal and differently ordered JSON; refreshed URL for same finalized object                          | Same semantic request replays; credential bytes/query strings do not alter identity                           |
| R03 | Same key from another user; same user in another workspace; removed membership                               | No cross-caller read/list/cancel/access/runtime leak; changed workspace cannot replay someone else's context  |
| R04 | Crash before local intent commit                                                                             | No Cloud job; a retry can admit normally                                                                      |
| R05 | Crash after intent commit before dispatch                                                                    | Restart discovers row and creates one job without the browser token                                           |
| R06 | Cloud commits receipt/job; response lost; local receipt write fails                                          | Recovery locates that job by key and does not create another                                                  |
| R07 | Two workers, lease expiry during an in-flight submit, stale completion after takeover                        | Cloud unique receipt prevents duplicate job; fenced local writes reject stale worker                          |
| R08 | Lookup miss while original submit is delayed; receipt store outage; public-v2 claim lifetime exceeded        | Same-key atomic admission or continued uncertainty; no new key or unprotected fallback                        |
| R09 | Crash/rollback inside Cloud receipt/job/accounting transaction                                               | Receipt/job/accounting commit together or none do; restart cannot consume allowance twice                     |
| R10 | Cancel before dispatch, during unknown submission, queued, executing, and racing completion                  | Closed-key fence or confirmed job cancellation; late dispatch cannot resurrect; completed job stays completed |
| R11 | Cancel response accepted or existing display status says cancelled while raw Cloud state is still cancelling | UI/status remains cancellation requested until actual terminal confirmation                                   |
| R12 | Stale poll after success; duplicate callback; unknown upstream status                                        | Terminal result never reopens; unsupported status does not fabricate progress                                 |
| R13 | Browser closed; service restart; admission flag disabled; definition unpublished                             | Existing runs still reconcile and deliver; no new disallowed run is admitted                                  |
| R14 | Capability wrong audience/run/hash/workspace, expiry, rotation, API-key revocation, forged actor body/header | Rejected through real M2M middleware; no impersonation, privileged workspace bypass or token upgrade          |
| R15 | Normal subscription/credit/provider/queue/runtime refusal                                                    | Workshop applies the same Cloud admission policy; no job and no extra charge on definitive rejection          |
| R16 | Cursor/filter tampering, equal timestamps, concurrent new run, byte-budget pagination                        | Owned history pages are stable, bounded and complete without duplicate/omitted older records                  |
| R17 | Cleanup of expired output/input; compacted job receipt; old identical retry                                  | Asset becomes unavailable, but retry cannot create a new job                                                  |

Exercise authorization through every public operation, including all output and
upload refresh links. An admin test identity must not accidentally bypass the
public caller-only contract. Verify denial responses do not reveal another
workspace's run ID or media metadata.

## Media and transport corpus

| ID  | Case                                                                                                                          | Observable proof                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| M01 | Real grant → signed PUT → APP URL submit for small image, video and audio                                                     | Binary bytes go only to storage; correct MIME and usable Cloud loader reference; no Comfy Authorization header on PUT |
| M02 | Grant issued but upload absent/partial; wrong owner/workspace/object; expired/deleted object                                  | Rejected before execution with a small error and no media echo                                                        |
| M03 | Still-valid PUT used twice; object changes during validation/import; stale generation                                         | Create-only constraint or generation check prevents substitution; finalized input digest cannot change                |
| M04 | MIME spoof, dimensions/duration too large, per-file/aggregate/count boundary                                                  | Actual content is checked and precise allowed boundary is enforced                                                    |
| M05 | HTTPS external host, redirects, URL credentials, malformed encoding, data/blob/base64/byte-array media, multipart run request | Strict rejection; no generic external fetch or inline fallback                                                        |
| M06 | Unknown/chunked length, oversized or compressed JSON, enormous inline media, oversized upstream metadata                      | Preparse bound holds through the production middleware chain; neither parsing nor logging buffers the full payload    |
| M07 | Selected output lacks trusted asset, malformed metadata, spoofed asset ID, inline upstream output/preview                     | Small per-file failure; raw body/media never reaches status, history, errors or idempotent replay                     |
| M08 | One of several outputs unavailable; signing throws or returns empty URL                                                       | Other files remain playable; partial delivery is explicit and inference is not resubmitted                            |
| M09 | URL expired but asset alive; asset deleted; grant expiry malformed; transient renewal failure                                 | Refresh same asset or report unavailable; no retry loop or false retention promise                                    |
| M10 | Transfer disconnect, signing outage after completed copy, worker restart after asset registration                             | Idempotent staging/delivery reuses the asset; no inference retry or leaked temporary files                            |
| M11 | Concurrent large input/output transfers at configured maximum; slow readers                                                   | Measured API/worker peak memory and temp disk stay within declared budgets; backpressure and concurrency limits work  |
| M12 | Signed image decode, video/audio playback/seek and download, same-asset URL renewal                                           | Real CORS/Range behavior works; playback position/state survives renewal                                              |
| M13 | Debug logs, tracing, errors, previews, history and malformed upstream response                                                | Canary prompts/tokens/signed queries/media bytes are absent; useful run/error IDs remain                              |
| M14 | Every personalized success/error route through edge/middleware                                                                | `no-store` survives; a second caller cannot receive a cached first caller's response                                  |

For M11, record fixture sizes, concurrency, process baseline, peak RSS/heap,
temporary disk high-water mark and cleanup. Set the pass budget before the run;
measure both API and the actual Cloud staging/worker path, not just a Go copy
helper. Unit tests additionally use readers that reject oversized read buffers
and count active streams. Those assertions do not substitute for the resource
measurement.

Storage fakes cannot prove signed-header/CORS behavior or bucket lifecycle.
Run M01/M03/M12 against real staging storage. Inspect limits at grant, API,
asset-import and worker boundaries; the lowest deployed limit is the supported
limit. Put cost-bearing tests behind explicit staging configuration and bounded
workflows, never ordinary unit-test execution.

## Browser, CLI and rollout corpus

- Pure controller tables cover attach, admit, uncertain POST, observation loss,
  token renewal, delivery failure/renewal, explicit cancellation and detach.
  Assert emitted commands and resulting public state, not timer internals.
- Deferred responses cover account/workspace switching during upload, POST,
  poll, list and signing; none can attach old results or grants to a new caller.
- Refresh before/after admission preserves attempt identity/form state and
  resumes the same run. Browser-storage denial is reported accurately while a
  known public run link remains usable. A new attempt cannot reuse an old key.
- History tests prove canonical replacement, the independent active-run lookup,
  ordering by visible output tiles, and polling stopping when work settles.
- Flag tests cover initial off, delayed answer, blocked PostHog, account change,
  stale cached answer, backend gate denial and disable-after-admission. Keep the
  Router saved-assets flag independent.
- Website E2E: signed-in discovery → controls → mocked grant/PUT/admission →
  ordered playback/download; reload/offline recovery; explicit cancel; account
  switch; flag off. Use real controller/network wiring with generated response
  fixtures. Do not repeat every schema case here.
- Use PR #18325 for visual/layout regression coverage: discovery hero/categories,
  two-line card titles, detail layout and Playground / Workflow / API tabs at
  desktop/mobile widths. Keep the simulated deployment demo separate. Verify
  graph preview has no auth/compute side effects and does not execute node code.
- CLI executes the same resolution/preparation/normalization conformance
  vectors. Verify exit/output behavior for incomplete delivery and observation
  interruption, and a resume-by-public-ID path without resubmission. Snippet
  tests check the intended request at a local server rather than only snapshots.
- Keep one integration test proving normal Router model run/snippet behavior
  through the new run-target boundary; workflow changes must not rewrite it.

## Staging acceptance record

Record the website/backend commits, generated contract versions, definition
digests, runtime manifest, approved caller/workspace references and enabled
flags. Do not store credentials, prompts containing personal data, signed URLs
or binary payloads in the record.

1. Publish an approved pilot definition from its authoring revision. Verify
   browser/CLI first-render defaults and at least one nested/promoted binding.
2. Upload through the real grant/direct-PUT flow. Execute in the caller's
   workspace, play/download selected outputs, then renew an expired link.
3. Drop the admission response and restart a recovery worker. Verify the same
   public run/upstream job and no extra admission or inference charge.
4. Cancel queued and executing runs, and exercise cancel during uncertain
   submission. Verify eventual authoritative status and ordinary Cloud billing
   policy; do not assert a refund just because Cancel was clicked.
5. Switch account/workspace and remove access. Verify isolation while background
   settlement continues. Disable admission and verify recovery still works.
6. Reconcile the run with actual Cloud usage/billing evidence in the caller's
   workspace, including partner-node usage if that pilot contains such nodes.
7. Attach storage lifecycle, input/output expiry, CORS/Range, no-store/logging
   and M11 resource-limit results. Record failures as failures and keep rollout
   off until corrected.

A successful image generation alone does not satisfy the image/video/audio,
failure-injection or billing acceptance. Use additional small approved workflows
when one pilot cannot exercise all modalities. No live run has been recorded yet.
