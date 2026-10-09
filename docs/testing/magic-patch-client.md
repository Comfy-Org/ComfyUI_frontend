# Magic Patch client checkpoint

The standalone Magic Patch service owns conversion requests and jobs. The
generated shared contract, transport-injected client and polling projection
remain unmounted. The Library action stays disabled until authenticated
gateway/service readiness exists.

Compose with the updated `api.fetchApi.bind(api)`, qualified readiness and
`useNodeAccountScope()` capture/current checks. The transport's third argument
is a synchronous dispatch guard: it MUST run immediately before each actual
fetch, including the remint retry, with no intervening await. Older or custom
two-argument transports that ignore this argument are not qualified. The guard
rejects changed scope, lost readiness and aborted requests after async auth
preparation. This does not authorize browser tenant headers or qualify a real
credential/workspace adapter.

Client policy `magic-patch-client-response-limits/1` owns these decoded-body
ceilings: JSON status/cancellation/pages **1,048,576 bytes**; detached report
**8,388,608 bytes**. Content-Length can reject early; absent, understated or
malformed length never bypasses the streamed-byte count. Reads stop and cancel
on overflow before JSON parsing, report hashing or final contiguous allocation.
Each read rechecks captured scope/readiness/caller abort. Accepted reports still
require both the expected SHA256 and matching header, then exact-byte hashing.

These are client acceptance budgets, not a claim that server/gateway output or
browser networking buffers are bounded. A decoded stream chunk may already
have been allocated by the browser. Retained chunks and the accepted contiguous
copy can coexist, with decoded text/object allocations afterward. Full response
deadlines, empty-chunk/fragmentation budgets and cumulative page/time/byte
ceilings for a whole traversal remain required before mounting the orchestrator.
No deployment negotiates these limits yet; server report sizing and any larger
report delivery need an explicitly versioned contract.

Operations return success or sanitized failure codes, including
`response_too_large`. A failed submission response can hide an admitted intent:
retain its exact source and idempotency key and reconcile before retry.
Withdrawal acknowledgement does not prove worker shutdown or runtime readiness.
Reports retain unknown semantic shape until the conversion-report validator is
implemented; digest equality alone does not confer admission.

Start each polling cycle without a cursor under a captured scope and scan ID.
Successful full traversals replace the unacknowledged listing; failed or stale
traversals preserve known state. This is not a snapshot/change-feed API.

Tests use the actual ComfyApi authentication/remint control flow with deferred
test auth and stubbed native fetch, plus streamed-body controls and Node
WebCrypto. They do not exercise real credentials, networks, browsers, nodes or
renders. Current Community source is aligned through FREDDY's frozen r6 c1ef299d
on exact92e; only the isolated DANNY successor changes the guarded transport.

Visual work follows the live Figma prerequisite in
`docs/guidance/design-standards.md`. Consent, progress mounting, graph refresh,
exact-release feedback and production route/browser acceptance remain pending.
