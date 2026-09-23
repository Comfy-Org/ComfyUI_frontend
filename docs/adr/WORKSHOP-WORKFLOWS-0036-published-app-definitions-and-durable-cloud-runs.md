# ADR-WORKSHOP-WORKFLOWS-0036: Published APP definitions and durable Cloud runs

Date: 2026-09-22

## Status

Proposed

## Context

FE-2736 makes author-selected APP controls executable in Models / Workshop,
using the caller's Cloud workspace and billing. FE-2737 later adds sponsored
serverless execution. These calls can incur cost after the browser disconnects;
publication, retries, media identity and cancellation therefore need stronger
contracts than a page that forwards a graph and waits for a response.

APP metadata identifies editor selections. It does not contain complete typed
bindings to the executable graph. Export can flatten nested instances, replace
virtual nodes, serialize custom widgets and fan promoted controls into several
inputs. Independently exporting the form and graph can change their meaning.

Cloud's current public v2 idempotency is a credential-scoped Redis claim, with
duplicate rejection and a finite lifetime. Its source currently fails open on
claim-store failure. It does not provide the durable receipt lookup needed to
recover a lost job-creation response. A lease in comfy-api cannot fix this gap
because its database is separate from the Cloud jobs database.

Media URLs are temporary capabilities, not stable object identity. Existing
Cloud loaders consume asset references, and job output content URLs require
authentication. Successful execution and successful delivery are separate facts.

## Decision

Publish reviewed, immutable APP definitions with private executable graphs and
explicit named bindings. Export their provenance through the editor's existing
graph conversion from one isolated authoring revision. Reject ambiguous,
unsupported or incompatible definitions before advertising them as runnable.
Keep a strict Workshop result boundary without changing the extensible editor
output contract in [NODE-OUTPUTS-0007](NODE-OUTPUTS-0007-output-passthrough-for-extensible-nodes.md).

comfy-api owns a durable caller-scoped admission record and recovery loop; ingest
and existing Cloud execution remain the execution and billing authority. Add a
Cloud receipt whose unique upstream key and job are committed in one Cloud
transaction. Replays reconcile that receipt. A cancel-before-submit operation
closes the same key, preventing a delayed worker from creating a job afterwards.
Retain receipt tombstones beyond asset deletion. This guarantees at-most-one
Cloud job for one admitted intent, not exactly-once computation.

Use a restricted, capability-authorized M2M contract for background submission,
observation and cancellation. The capability binds an admitted run and verified
caller context; ingest rechecks current policy before creating compute. Keep
browser tokens and service credentials out of persisted run identity and public
definitions. comfy-api stays build-isolated and calls ingest over a generated
HTTP client.

Use dedicated Ed25519 capabilities so ingest holds only verification keys,
separate from the M2M service secret. Bound each token to one operation and at
most five minutes; overlapping key IDs permit rotation. API-key provenance must
retain a stable verified credential ID for revocation checks.

Prepare policy outside the receipt transaction, then recheck current access
using its connection. Holding a receipt lock while borrowing another database
connection can deadlock under concurrent retries that fill the connection pool.
The transaction owns job creation, allowance consumption and the receipt;
definitive rejection rolls back admission side effects before recording its
receipt. Per-caller/workspace serialization protects the shared queue limit.

Reuse storage grants and direct PUT, adding workflow ownership, authoritative
expiry, create-only upload constraints and immutable finalization. Convert
authorized URLs to Cloud assets internally. Store stable asset references;
generate URL-only responses and refresh links at read time. Keep execution,
observation, cancellation intent and per-file delivery state distinct, with
conditional monotonic writes and fenced recovery leases.

Use a dedicated private input bucket with default event-based object holds.
The existing generic storage table and bucket lifecycle cannot establish
ownership or protect inputs while queued. Claim expired upload records before
releasing holds; extend retention before dispatch. A grant pins exact upload
bytes and create-only semantics, and finalization records the generation and
digest after bounded inspection. This adds cleanup responsibility and requires
bucket/IAM configuration before rollout. Never infer physical retention from a
database timestamp alone.

Use a request-scoped IAM signing adapter: the storage SDK's default signer
detaches cancellation, and its V4 expiry can be earlier than the requested time.
Decode the signed URL's actual expiry for the client instead of reporting a
locally estimated TTL.

Revalidate the caller's current workspace and credential authority through Cloud
on public storage operations. Local principal identity must agree; ownership
does not elevate a restricted JWT or OAuth grant. Keep verified provenance
separate from membership role so later background capabilities preserve the
authority actually presented. Disabling upload admission leaves finalization,
access refresh and cleanup operational.

Share default resolution, upload preparation and output presentation between
browser and CLI. Give the website one scoped controller for run identity and
observation. Navigation/account changes detach; only explicit Cancel requests
job cancellation. Add a small run-target discriminator without folding Router
and workflow transport behavior into one state machine.

Implement only caller-workspace Cloud execution in phase 1. Admission gating is
server-enforced; `workshop-workflows-enabled` controls the website experience.
Disabling new admission must preserve recovery and access to existing runs.

### Alternatives considered

- **Browser/SDK direct to public Cloud v2:** smaller initial integration, but
  cannot provide durable replay across missing responses, credential changes
  and Redis failures. It also leaves no trusted recovery actor after logout.
- **Workshop leases without Cloud changes:** serializes workers while a lease
  is held, but an expired lease cannot stop an already dispatched request. Two
  database transactions require durable arbitration at job creation.
- **Persist a caller token or use a service execution account:** convenient
  for a background worker, but tokens expire and a service account changes the
  caller's authorization/billing boundary.
- **Infer bindings from widget names or array positions:** avoids exporter
  work, but fails for nested instances, promoted fan-out, links and serializers.
- **Introduce a second scheduler or a general workflow engine:** duplicates
  existing execution responsibilities. A bounded, managed reconciler over the
  durable run rows is sufficient for this phase.
- **Reuse Router's best-effort URL conversion:** may preserve inline bodies on
  conversion/storage failure, violating the workflow wire contract.
- **Implement sponsored quota now:** adds transactional accounting before its
  separate acceptance policy is settled. The adapter boundary allows phase 2
  without adding speculative states or tables now.

## Consequences

### Positive

The authoring contract, admission identity, execution authority and delivery
lifetime have explicit owners. Browser and worker restarts reconcile existing
work without depending on a session token or a short-lived URL. Cloud policy
and billing remain on their established path. Tests can prove these properties
at service and transaction boundaries instead of relying on paid browser E2E.

### Negative

This requires coordinated frontend, comfy-api, ingest and database changes.
Publication tooling and durable Cloud receipts are prerequisites, so a frontend
wrapper alone cannot ship the feature. Capability issuance and revocation need
Cloud auth review. Retention, runtime compatibility and transfer limits must be
verified in the deployed environment. Unsupported custom controls remain
browse-only until an explicit adapter is available.

## Notes

See the [architecture and source findings](../architecture/workshop-cloud-workflows.md)
and [required test evidence](../testing/workshop-cloud-workflows.md).
The [workflow TDD](https://app.notion.com/p/3e26d73d3650818d9f0cf28fc9f506d4)
sets the requirements; this decision resolves implementation gaps found in the
Cloud and frontend source on 2026-09-22. No staging execution is implied by this
proposed decision.
