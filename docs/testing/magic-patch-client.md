# Magic Patch client checkpoint

The client and poller remain unmounted. The Library action stays disabled until
actual authenticated gateway/service readiness is qualified. Neither an import
nor a passing test enables a capability.

Compose with updated `api.fetchApi.bind(api)`, qualified readiness and the
`useNodeAccountScope()` capture/current guard. The transport's third argument
MUST run synchronously immediately before every actual fetch and each remint
retry, without an intervening await. Older/custom transports ignoring it are
unqualified. The guard rejects changed account/workspace generation, lost
readiness and caller abort after asynchronous auth preparation. Real
credential/session/CSRF composition remains I04/I06.

Current client policy `magic-patch-client-response-limits/2` retains decoded-body
ceilings of **1,048,576 bytes JSON** and **8,388,608 bytes report**. It additionally
permits at most **16,384 reader.read calls**, including empty chunks and the EOF
read, and **10 seconds per body read**. Content-Length can refuse early; actual
stream counts enforce bounds even when length is absent/understated. Overflow
stops/cancels before retaining the excessive chunk, final contiguous allocation,
parse or hash. Fragmented/empty streams exhaust the read budget even if they
never exceed the byte limit.

The body deadline starts after response headers, when the body reader is
acquired. It is distinct from the identity wrapper deadline and does not bound
initial auth preparation, HTTP response-header latency or synchronous parse/hash
CPU. Caller abort and body timeout unblock a pending read even when an injected
transport ignores the signal; scope/readiness are checked around each read.
Cancellation is requested without waiting for an uncooperative underlying
cancel acknowledgement. This does not certify stopped network/worker activity.

A browser/network chunk may already be allocated before the client sees it.
Retained chunks, accepted contiguous copy, text and parsed objects can coexist.
These are client acceptance/work budgets, not universal browser memory ceilings,
server quotas, compressed-wire accounting or an agreed report delivery format.
Server report sizing/schema and version negotiation remain pending.

Poller policy `magic-patch-client-traversal-limits/1` allows **20 pages**,
**1,000 returned entries including duplicates**, and **15 seconds** per traversal.
Composed with this bounded client, it accepts at most **20 MiB decoded bodies**.
Refresh starts cursorless under a new scan. Scope switch, disable and superseding
refresh abort the old scan. Late abort-insensitive replies cannot publish or get
another page. Failures/incomplete scans preserve the last complete projection.
This is not a snapshot or durable change-feed API.

Client methods return success or sanitized failure codes. New body failures are
`response_timeout` and `response_too_fragmented`; `response_too_large` remains
the byte-limit refusal. A lost/failed submission response can hide an admitted
intent: preserve exact source/idempotency and reconcile before retry. None of
these transport failures is a conversion rejection or eligible repair vote.
Withdrawal acknowledgement does not prove worker shutdown or runtime readiness.

Reports retain unknown semantic shape until the report validator exists. Both
expected/header SHA256 and exact accepted bytes must match. Digest equality
alone does not validate conversion semantics, admission or execution.

Local tests exercise actual ComfyApi control flow using test auth/native fetch,
bounded streams, fake timers, and an abort-insensitive/cancel-unacknowledged
stream. FREDDY independently reviewed a53's guard/per-body byte fixes without
rerunning tests; v2 consumption and ccd traversal are newer successor work.
Community r7 is preserved in the isolated branch. No real credential, network,
browser, render, publication or runtime acceptance is inferred.

Visual work requires the live Figma standards prerequisite. Consent, startup/
reconnect mounting, progress, graph refresh, feedback, real gateway composition
and actual browser scope/cancellation/lifecycle coverage remain pending.

Deadlines are stored against a monotonic clock, not inferred from a timer firing.
The poller checks before calling list and immediately after its awaited result,
and forwards a traversal guard through list into the actual native dispatch/remint
callback. Older list adapters that ignore this guard are unqualified. Async auth
preparation cannot dispatch an overdue poll merely because the timer was delayed.
The body reader similarly checks performance.now before/after reads and before
returning accepted bytes. Timers remain wakeups for stalled operations; a delayed
timer cannot make an overdue response eligible. Clock injection is for owned
poller composition/tests; the production default is performance.now. Neither
these checks nor timers preempt synchronous JavaScript CPU execution.
