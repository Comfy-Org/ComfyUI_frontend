# ADR-008: caller-owned, explicitly passed event sink

- Status: Accepted (Option B approved in `christian-byrne/blocked-on-christian#121`)
- Date: 2026-08-29
- Invariants: KA-3, KA-4, KA-11; FC-3; ADR-021 statelessness boundary

## Context

`@comfyorg/comfy-multi-player` (cmp) is the one browser-and-Node semantic-op applier. It must
remain portable, deterministic, and stateless modulo caller-owned documents. Hosts nevertheless
need structured notice of rejected input and unexpected failures so the frontend can report them
and the Node doc host can forward them across its HTTP boundary to Go structured logs/`agenttel`.
cmp must not import a telemetry SDK or know either host.

ADR-021 made the state boundary explicit: process-global mutable state in cmp is not an acceptable
substitute for caller-owned state. The `check:stateless` gate enforces this boundary.

## Decision model

We compare options on statelessness, default-path cost, failure isolation, call-site disruption,
and the ability to preserve a language-agnostic contract.

### Option A: module-global `registerEventSink(sink)`

This matches the frontend service's register/dispatch ergonomics and requires no applier signature
change. It also makes importing cmp mutate process-wide behavior, creates test and multi-tenant
cross-talk, and directly contradicts ADR-021's statelessness decision. Rejected.

### Option B: explicitly pass a sink in caller-owned call context

An optional final context parameter keeps ownership and lifetime at the host boundary. No context
means one presence branch and no event allocation. It slightly widens participating entry-point
signatures, but preserves old calls and makes concurrent tenants independent. Chosen.

### Option C: return events alongside semantic results

This is the purest data-flow model and makes delivery impossible to hide. It is also the most
invasive: every return type and caller must change, including APIs whose current contract is a
throw or `void`. It risks confusing semantic outcomes with best-effort observability. Rejected for
this scaffold; reconsider only if events later become durable protocol facts.

## Decision

Add a dependency-free `events.ts` surface:

```ts
type CmpEventSink = (event: CmpEvent) => undefined
interface CmpCallContext { readonly eventSink?: CmpEventSink }

applyOps(doc, ops, catalog?, context?)
```

The host passes context per call. There is no registration API, singleton, mutable registry,
timer, queue, retry, exporter, or async work. Emission is synchronous fire-and-forget. The emitter
catches and discards every synchronous sink throw. The TypeScript sink returns `undefined`, so an
`async` callback is not assignable. JavaScript hosts must contain exporter failures behind a
synchronous enqueue-only adapter and must not return a thenable. A sink must be O(1), must not
re-enter cmp, and receives no document or op payload. Under that contract, a throwing sink cannot
change an outcome, mutation, abort-remainder behavior, or thrown error.

Call sites test for `eventSink` before constructing the event. With no sink, the path performs only
the branch and allocates no telemetry object. No `EXCEPTIONS.md` entry is needed: this preserves
KA-3 and ADR-021's statelessness boundary and adds no runtime dependency.

## Versioned wire schema

Every event is a plain object containing only JSON scalar values. No `Error`, class instance,
function, symbol, bigint, document value, op payload, or Yjs value may cross the boundary.

```json
{
  "schema_version": 1,
  "type": "op_rejected",
  "source": "applyOps",
  "code": "unknown_widget",
  "message": "human-readable bounded explanation",
  "error_name": "OpRejectedError",
  "op_id": "uuid4hex",
  "batch_index": 0
}
```

Required fields are `schema_version`, `type`, `source`, `code`, and `message`. The remaining
fields are optional JSON scalars; numbers must be finite JSON numbers. Consumers must reject unsupported `schema_version` values and
must tolerate unknown `type` values within a supported schema so producers can add taxonomy
members without breaking ingestion. A breaking field or meaning change increments the schema.

## Taxonomy grounded in current code

- `op_rejected`: `applyOps` catches `OpRejectedError`; includes malformed/unknown/deferred/frozen
  ops, op-id reuse, catalog/widget/slot/input failures, and validation refusals in `applier.ts`.
- `applier_error`: the same catch converts a non-`OpRejectedError` into existing `apply_failed`.
- `op_conflict`: existing successful `lww-dropped` outcomes in `applier.ts`; not wired in this
  scaffold because they are expected semantic outcomes, not errors.
- `limit_violation`: the pre-loop `MAX_OPS_PER_BATCH` branch plus `opBoundsRefusal` depth,
  collection, and cost limits from `limits.ts`. The scaffold wires the batch limit; payload-limit
  classification remains a follow-up because it currently surfaces as `OpRejectedError`.
- `clock_anomaly`: `clock.ts` rejects malformed stamp ledgers, non-advancing/invalid/exhausted
  Lamport counters, and unseeded required producers. Follow-up wiring must preserve thrown errors.
- `migration`: the successful v1-to-v2 step in `migrate.ts`. A current-version no-op emits nothing.
- `schema_mismatch`: `SchemaVersionError` paths in `schema-version.ts` and `migrate.ts`, including
  absent/unreadable, older, newer, and caller/document-version disagreement.

The initial implementation emits only `op_rejected`, `applier_error`, and the batch
`limit_violation`. Remaining wiring is deliberately follow-up work, with failure-isolation tests
required at each entry point.

## Host flow

```text
+-----------------------+       plain CmpEvent v1       +------------------------+
| cmp applyOps (now)    | ----------------------------> | caller-owned sink      |
+-----------------------+                               +-----------+------------+
        |                                                               |
        | semantic result/throw unchanged                               |
        v                                                               +--> FE reporter
+-----------------------+                                               |
| caller                |                                               +--> Node doc host
+-----------------------+                                                        |
                                                                                 v
                                                                      Go logs / agenttel attrs
```

Clock/read/migrate emission uses the same future path but is follow-up work, not part of this scaffold.

Go does not import cmp. The Node doc host registers the per-call callback and maps the JSON-safe
event at its HTTP boundary. The Go side validates `schema_version` before mapping allowlisted scalar
fields to `internal/agenttel`; payloads and messages must not become high-cardinality attributes.

## Consequences and follow-ups

- Public exports gain types/constants and `applyOps` gains one optional trailing parameter; existing
  callers are source-compatible.
- Add Node doc-host forwarding and a versioned Go decoder/mapping in a separate cloud PR.
- Add an FE adapter in a separate frontend PR; cmp never imports the frontend event service.
- Wire clock, migration, schema-read, payload-limit, and optional conflict events separately, with
  byte/result/throw equivalence tests against a throwing sink.
- Decide message length/redaction at each host boundary before exporting. `code`, type, source,
  and bounded identifiers are the stable machine fields; `message` is diagnostic, not a metric key.
- The language-neutral golden vectors in `fixtures/cmp-events/v1.jsonl` are consumed by the
  TypeScript producer test. Every Go decoder must consume those same vectors before it lands;
  prose and a TS interface alone are not a cross-language drift gate.
- Run the unchanged purity/import/stateless gates. No exception is requested.
