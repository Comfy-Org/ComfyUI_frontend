# ADR-API-CONNECTIONS-0001: Host-evaluated connection policies

Date: 2026-10-26

## Status

Proposed

## Context

A link attempt needs an immediate decision before the host replaces an existing
input connection. The native `onBeforeConnect` callback supplies that decision,
but a worker cannot answer synchronously. Blocking the main thread on a worker
would also run untrusted extension code during a pointer gesture.

Extensions need common graph constraints: allowed peer types and slots, cycle
prevention, distinct input sources, and output prerequisites. Their algorithms
remain in the extensions. The host needs only bounded data to enforce these
constraints.

## Decision

Add `NodeDefBuilder.setConnectionPolicy()` and
`NodeDefinition.connectionPolicy`. A policy is plain data evaluated through the
existing input/output veto hooks. There are no new entity methods or mutable
slot fields.

Each extension owns its policy. A successful replacement validates and copies
the entire value before swapping it; invalid replacements return `false` and
retain the previous value. `null` clears that extension's policy. Disposing the
extension deactivates its policy and prevents a captured builder from reviving
it. No policy data enters workflow serialization.

The host checks both endpoints. Any policy, existing native callback, or core
type refusal wins. A later approval cannot override a refusal. Policy checks
run before input replacement and produce no graph mutations.

Slot selectors use the existing `SlotRef` contract: stable ID, exact name, or
explicit `{ index }`. Stable IDs follow live slot reordering. Missing or
ambiguous selectors refuse the attempt. Peer identity is resolved in the actual
owning graph, including its own input/output boundary slots; a same-ID node in
another graph is never a peer. Traversal stops at the subgraph boundary.

Traversal is limited to 4,096 node, slot, and edge inspection steps per endpoint
policy evaluation. Exhausting that budget refuses the attempt. Explicit transit
types use exact equality. No substring rules, predicates, source inspection, or
pack identifiers are introduced.

Policies guard new local operations. Workflow loading and authoritative remote
command replay bypass them, so a later extension configuration cannot rewrite
the meaning of a saved or already-accepted graph. The existing native callback
contract is unchanged.

## Worker authority and subsequent link-release work

This draft implements the native host facility. It adds no worker grant and
does not enable synchronous callbacks in workers.

The retained bridge forwards arbitrary builder method names and copies
definition data into the native registry. Adding a public member would make
it reachable from that bridge even before updating its guest recorder.
Therefore an installed `ExtensionHostProvider` disables policy admission and
evaluation for the whole host. Definition admission throws before registration;
builder updates return `false` without changing the last valid policy. Removing
the provider resumes those policies. A future worker bridge must replace this
guard with actual source attribution and ownership checks before opting in.

A worker bridge must verify that a pack owns the affected node type, or has an
explicit graph-tool grant. A graph gesture and an owned widget do not grant
permission to mutate arbitrary peer nodes. Graph identity, grant revocation,
registration disposal, and the host's trusted source attribution must be
checked before admitting a worker declaration.

User-driven link-release handling is a separate facility. It needs a bounded,
host-issued gesture containing graph and slot identities, a declared matching
filter, and deterministic handler precedence. It must reuse published graph
operations under existing authority. The current worker batch groups undo but
retains earlier writes when a later write fails; it does not establish an
atomic transaction. A link-release API must not promise rollback or borrow
cross-pack write authority from that batch.

## Alternatives considered

- Await a worker veto: incompatible with the synchronous connection path.
- Keep cached worker answers: stale state could replace an existing link after
  the worker's condition changed.
- Restore prototype patches: changes other extensions' behavior and makes
  ordering implicit.
- Add node-specific graph algorithms: expands the public API around individual
  consumers rather than reusable constraints.
- Add mutable slot linkability state: duplicates live topology requirements;
  connected-input prerequisites can be evaluated directly by the host.

## Consequences

Native extensions can declare constraints without replacing graph prototypes.
Validation and traversal have fixed bounds, and a refusal preserves existing
links. Policy data remains outside persistent entity state, consistent with
the dedicated-store and command direction in ADR-ECS-0008 and
ADR-CRDT-LAYOUT-0003.

The native implementation does not establish worker parity, whole-pack
compatibility, or general graph transactions. Resource-limit refusals and stale
slot selectors require an extension to simplify or update its declaration.
