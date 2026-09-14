# ADR-022: pure canonical operation inspection

- **Status:** Accepted
- **Date:** 2026-09-03
- **Invariants:** KA-2, KA-3, KA-4; FC-2, FC-3

## Context

ADR-029 moves durable applied-operation identity out of an indefinitely growing Yjs `__applied`
map. Storage needs each stamped operation's exact canonical bytes, SHA-256 digest, creator actor,
and creator Lamport counter before it can classify a retry. Reimplementing any of those facts in
Go would create a second canonicalizer and allow browser, Node, and storage semantics to drift.

`applyOps` already validates the wire envelope, canonicalizes the whole semantic operation, and
hashes those canonical bytes. It cannot be used for preflight because it also requires and mutates
a document.

## Decision

Expose `inspectOps(ops)` from the package entrypoint. It is synchronous, dependency-free, and pure:
it reads only its arguments and returns one result per input in input order:

```text
{ index, op_id, canonical_op, canonical_digest,
  creator_actor, creator_lamport }
```

`canonical_op` is the UTF-8 encoding of the exact canonical string used by `applyOps`.
`canonical_digest` is its raw 32-byte SHA-256. Creator identity comes from the required op stamp
`[counter, actor]`, never server arrival order or call metadata.

Inspection runs the same envelope validation, operation bounds, canonicalizer, SHA-256
implementation, and batch-size limit as `applyOps`. It does not perform document- or
catalog-dependent semantic checks. Two identical occurrences of one `op_id` remain in the ordered
result. If one batch reuses an `op_id` with different canonical bytes, inspection throws the
existing typed `OpRejectedError` with code `op_id_reuse` before a host can call storage.

The Node doc host may base64-encode these byte arrays for JSON transport. Go may decode, compare,
and persist them, but must not canonicalize, hash, extract stamps, or infer semantic order.

```diagram
stamped ops
    │
    ▼
┌────────────────────────────────┐
│ inspectOps                     │
│ validate → canonicalize → hash │
└───────────────┬────────────────┘
                │ ordered immutable facts
                ▼
┌────────────────────────────────┐
│ host transport / storage       │
│ no semantic implementation     │
└────────────────────────────────┘
```

## Consequences

- CMP remains the sole canonicalizer and semantic applier (KA-3, FC-3).
- Duplicate and changed-payload reuse classification remains byte-identical to the apply boundary
  (KA-4).
- Creator-owned Lamport order remains embedded in and extracted from the operation (KA-2).
- Cloud indexes and arrival order remain durability coordinates, never semantic order (FC-2).
- A storage preflight cannot certify document- or catalog-dependent applicability; `applyOps`
  retains that authority.

## Alternatives considered

- **Canonicalize and hash in Go:** rejected because it creates a second implementation and
  violates FC-3.
- **Apply against a throwaway Y.Doc:** rejected because inspection would acquire irrelevant
  document/catalog preconditions and duplicate the host's apply work.
- **Return JSON strings or hex digests:** rejected because storage owns exact bytes and a raw
  32-byte digest; transport encoding belongs to the host boundary.

## Glossary

- **Canonical operation bytes:** deterministic UTF-8 bytes of the complete semantic-op envelope.
- **CMP:** `@comfyorg/comfy-multi-player`, the shared browser-and-Node package.
- **Creator Lamport counter:** the non-negative counter in an operation's authoritative stamp.
- **FC:** foreclose invariant, a design direction the program must not enter.
- **KA:** keep-alive invariant, behavior the program must preserve.
- **Storage preflight:** pure operation inspection before any durable lookup or write.
