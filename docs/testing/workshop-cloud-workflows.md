# Cloud workflow test strategy

The 2026-09-23 scope correction in
[WORKSHOP-CATALOG-0037](../adr/WORKSHOP-CATALOG-0037-shared-pages-and-authored-execution-catalogs.md)
governs this corpus. Existing Models INPUTS, shared panels and provider-independent
validation consume offline-authored execution records. Exporter/APP discovery
tests from earlier work are historical evidence, not FE-2736 acceptance gates.

Initial prepared-data check, 2026-09-23: the three records in
`apps/website/src/content/workshop-workflows.jsonl` passed 30 acceptance/rejection
cases through the existing Models `validateWorkshopInput` function. These cover
valid values, missing/unknown fields, wrong scalar types, HTTP and inline media.
Their graphs match the pinned #18325 API artifacts; explicit input targets,
prompt defaults and selected output nodes were checked separately. These are
offline content checks, not evidence of page wiring, durable execution or a
Cloud staging run.

The website now consumes those records through the master/execution catalog
join. Tests cover explicit mappings and malformed records, master widget order,
false/zero/empty defaults, unsupported controls, missing/wrong-type matches,
zero-input forms, graph-free page payloads, and workflow flag reset on caller
changes. Browser tests exercise gated discovery/direct routes, shared uploads
and prompt controls, example switching, and existing Router pages. Desktop and
mobile checks cover the #18325-based workflow composition. Cloud browser
submission remains unavailable; these checks do not prove inference or recovery.

On the rebased website, all 8,275 unit tests pass (four skipped), alongside
typecheck, lint, formatting, knip, production build and five focused browser
scenarios. Desktop/mobile screenshots are attached to draft PR #18615. No
workflow has been run or billed in Cloud through this page yet.

Cloud commit `38617e73d2` replaces the superseded APP compiler and review command
with prepared catalog consumption. The same three JSONL records produce their
expected Cloud input targets and prompt defaults. Tests cover scalar overrides,
ordered outputs, zero-input workflows, stale versions, independent graph copies,
URL-only media, duplicate inputs and bounded expansion. Catalog, media, HTTP
boundary and caller-client tests pass under the race detector; vet and focused
static checks pass. Cloud asset staging and run API integration remain pending.

Status: proposed runtime corpus for FE-2736. Initial public wire-contract tests
and portable examples are implemented in Cloud commit `4d1c96f1ed`, under
`services/comfy-api/workshop/`. They cover scalar preservation, request/result
shapes, required idempotency headers, declared auth/cache policy, and withholding
unimplemented routes from registration and API publication.

Cloud commit `1b6c5abdaa` adds real-Postgres receipt and admission tests under
`services/ingest/server/services/workshop/` and `server/implementation/`.
They prove one job/allowance debit under sixteen concurrent retries, changed
identity rejection, transaction and commit failure rollback, retained receipts
after job deletion, cancel-before-submit fencing, and queue-limit serialization.
A real job state-machine test checks job-scoped cancellation and terminal
confirmation. Other tests cover expired/rotated capabilities, credential
revocation, access removal, identity-header spoofing, both M2M factors, bounded
JSON and no-store responses. These suites pass with the race detector; the new
concurrency tests also exposed and fixed an unsynchronized shared PostHog test
double.

Cloud commit `b55e26bb50` adds Postgres/race coverage for owned upload grants,
quota contention, immutable finalization, refreshed access, expiry and cleanup.
Tests stream four simultaneous 25 MiB inputs with read buffers bounded to
32 KiB, and reject checksum/size/type mismatches without persisting a finalized
identity. FFmpeg/FFprobe fixtures cover MP4/WebM and WAV/MP3/FLAC/Ogg; image
inspection covers declared types and dimension/pixel limits. GCS SDK tests
check signed create-only/size/type constraints and decode the actual expiry.
IAM tests cover request cancellation and bounded, sanitized failures.
Follow-up `05415b7597` adds composed generated-handler/real-Postgres tests for
grant/finalize/access, account/workspace switching, live membership revocation,
expired credentials, signer recovery and access after admission disablement.
Middleware tests cover request caps, compressed/inline/unknown payload rejection,
parser-error sanitization, no-store and omission of bodies/grants from logs and
analytics. Cloud JWT tests preserve restricted permissions and OAuth provenance.
The race detector, vet/static checks, generation drift and formatting pass.
Existing SQLite-backed tests exposed an Ent check-parenthesization issue; both
SQLite tests and PostgreSQL migration/Ent comparison pass after the correction.
These cover parts of M01/M03–M05/M10/M11 below; real signed PUT/CORS, Cloud asset
staging, deployed auth and result delivery remain unproved.

Historical, superseded publication work: Cloud commit `96961fe8b8` adds the
export-artifact compiler and local review command.
Frontend commit `ebf6cdf7f2` supplies a second portable export fixture: two nested
instances with promoted fan-out and ordered previews. Backend tests consume the
same bytes and assert literal target values and output order. Rejection cases
cover altered digests, stale selections, missing or foreign targets, ambiguous
legacy identities, muted hosts, incompatible schemas/defaults, fixed-field
overrides, duplicate JSON members, unsafe numbers and numeric/product bounds.
Prepared inputs preserve false/zero/empty values and cannot mutate definitions.
A 2,048-target string expansion is rejected before graph copying; the allocation
test caps rejected preparation at 2 MiB per operation. Go race/vet/static checks
and formatting pass; frontend tests, typecheck, lint, knip and formatting pass.

Follow-up `de129fc7fc` fixes image finalization after real APNG, animated WebP and
MPO fixtures reproduced acceptance by the header-only inspector. Bounded frame
inspection now rejects these sequences, unknown frame counts and truncated PNG
pixel data while accepting static PNG/JPEG/WebP. The media and composed upload
HTTP suites pass under the race detector. Video frame accounting and reviewed
per-definition media budgets remain unproved.

This is Cloud-boundary evidence for parts of R01–R03, R06, R08–R11, R14, R15 and R17,
plus publication evidence for parts of P01–P06, P08/P09 and P11.
It does not prove comfy-api's durable worker/leases, public-operation isolation,
public-form/browser/CLI parity, media delivery or real caller billing. The matrix
below remains the verification contract for the
[architecture](../architecture/workshop-cloud-workflows.md), not a report of
completed feature or staging acceptance.

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

| Layer            | Existing corpus                                                                           | Proposed additions                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Catalog          | Models content, identity, input schema and browse tests                                   | Master/execution intersection, explicit workflow mappings and malformed-record diagnostics                                          |
| Shared form      | Existing Models INPUTS, schema validation and field component tests                       | Identical validation for declared inputs across MODEL, CLOUD and SERVERLESS; no provider-specific form paths                        |
| Shared render    | Website `router-render.test.ts`, `workshop-url-upload.test.ts`, parameter/snippet tests   | Workflow defaults/materialization conformance, URL upload and strict output parsing; protect Router behavior at the shared boundary |
| Website state/UI | Draft, delivery, session, account and PostHog tests; `apps/website/e2e/workshop*.spec.ts` | Pure controller transition tests, narrow component tests, and a few wiring E2Es using `blockExternalMedia`                          |
| comfy-api        | `integration-tests/comfy-api/`, storage grant/signer tests, Router transport/worker tests | Workshop HTTP/repository/recovery suites using the existing real-Postgres setup and managed-worker test patterns                    |
| Ingest/Cloud     | Job cancellation, prompt policy, auth/capability and inference input/output tests         | Receipt/admission races, M2M isolation, scoped asset staging, selected output manifest and policy parity                            |
| Staging          | Existing Cloud workflow/billing harnesses                                                 | Explicitly opt-in, bounded-cost workflow acceptance with evidence artifacts                                                         |

Keep one versioned fixture manifest shared by publication and backend contract
tests. Record fixture purpose, catalog/definition versions, graph references,
literal bindings/defaults/output order, and expected validation errors. Consumer
tests must import the published fixtures rather than manufacture incompatible
lookalikes. Do not copy credentials, signed URLs, private user graphs or large
generated media into the repository.

## Publication and parameter corpus

| ID  | Fixture / behavior                                                                                                  | Observable proof                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P01 | Existing Models INPUTS for text, number/integer, enum, boolean and media; zero-input page                           | Master widgets and declared native types/defaults agree; prepared requests match literal fixtures                           |
| P02 | Explicit mappings to multiple inputs and flattened nested node IDs                                                  | Exactly the declared targets change; unrelated inputs stay fixed; no subgraph discovery                                     |
| P03 | Changed labels/order with stable page input and target IDs                                                          | Mapping and validation remain correct without display-name or position matching                                             |
| P04 | Unknown page input, missing native target, incompatible declared type or unsupported widget                         | Catalog checks reject invalid records; runtime never infers a replacement mapping or control                                |
| P05 | JSONL authored independently of editor APP metadata, serializers or exporter versions                               | Catalog and requests work using only prepared data; editor metadata is not consulted                                        |
| P06 | Declared multiple output nodes/keys, file order and mixed modalities                                                | Exactly the catalog's selected outputs are delivered through shared output components                                       |
| P07 | Defaults/example, standard override, workflow override, explicit snapshot                                           | Browser/CLI/snippet and server normalized values agree; snapshot-plus-overrides is rejected                                 |
| P08 | Missing versus null, false/zero/empty, finite/integer/unsafe numeric boundaries, invalid enum and unknown keys      | Correct values accepted; invalid values rejected before job admission                                                       |
| P09 | Resolution/steps/duration/batch limits and interacting constraints; unexposed field injection                       | Both sides of each boundary; no mutation of fixed graph inputs                                                              |
| P10 | Same key with random seed intent, fresh key with random intent                                                      | Retry retains seed/job; fresh logical run can resolve a new seed                                                            |
| P11 | Stale public version, altered digest, changed runtime/node schema, unavailable model asset                          | Retained compatible version runs or a stable definition error is returned; no silent migration                              |
| P12 | Master-only entry, execution-only entry, missing/wrong target type, duplicate IDs and valid Router/workflow matches | Only matching master entries appear in discovery, detail routes and page data; catalog entries create no pages              |
| P13 | The same declared input constraints with MODEL, CLOUD and SERVERLESS targets                                        | Shared validation returns the same acceptance and field errors independently of provider; no render call for invalid inputs |
| P14 | PR #18325 layout and ordinary numeric/media controls for curated workflows                                          | One page/form implementation consumes master INPUTS; workflow JSONL contains native mappings without another widget list    |

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

1. Prepare an approved pilot JSONL record offline and match it to its master
   page. Verify browser/CLI defaults and at least one explicit nested or multiple
   target mapping; the page reuses the existing Models controls and validator.
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
