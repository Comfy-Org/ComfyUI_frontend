# ADR-SUBGRAPH-CONSTRUCTION-0063: Resolve receiving ownership before construction

Date: 2026-11-27

## Status

Proposed

## Context

A registered subgraph type can occur in several open workflows with different
schemas and instance defaults. The global registry selects executable behavior
without encoding the receiving workflow's ownership. Resolving ownership after
construction is too late: constructors already configure widgets, install
listeners, and invoke extension hooks.

Legacy extensions subclass generated nodes and call `super(title)`. Replacing
such a subclass with the receiving owner's generated class would skip the
extension's constructor and overrides. Existing consumers also observe static
metadata on generated classes, so replacing all owner-specific classes with one
owner-neutral class requires a separate extension API migration.

## Decision

Resolve registration and receiving ownership in a synchronous preparation step
before invoking constructors. Return distinct outcomes for unavailable types,
missing owned definitions, stale preparation, constructor exceptions, and
`onNodeCreated` exceptions. Callers own graph attachment and destructive edits.
The legacy `createNode` interface preserves its omitted-graph default and its
phase-specific exception behavior.

Generated construction receives resolved ownership directly. Title-only
extension construction uses a private, consumed frame matched to the exact
constructor and restored in `finally`. Keep owner-specific generated classes
and their supplied schema and instance defaults in the same owner registration.
Runtime structural metadata follows the node's owned definition; static catalog
metadata remains available.

Required conversion checks every member's availability before constructing any
member. Construction receipts remain owned through callback-bearing expansion,
as described in [ADR-SUBGRAPH-LIFETIME-0064](./SUBGRAPH-LIFETIME-0064-own-core-work-through-callback-completion.md).
The follower classifies recovery from the actual construction outcome and
builds a replacement before removing the incumbent shell. Its existing graph
identity, live layout, and remote-write provenance remain authoritative.

Enroll core subscriptions and deferred input work in a complete node lifetime.
Cancel that work if construction fails or its operation abandons the node.
Do not invoke arbitrary removal callbacks on unattached nodes.

## Alternatives and consequences

- Post-construction rebinding cannot undo callbacks that used the wrong owner.
- A universal graph transaction would have to reconcile incompatible
  configure/add ordering and roll back arbitrary extension effects. This
  decision guarantees availability checking without constructors and
  cancellation of enrolled core subscriptions, not full rollback.
- An owner-neutral generated class would remove more selection machinery but
  break the static-metadata contract. It does not solve title-only extension
  transport by itself.
- A title-only protocol cannot distinguish arbitrary raw construction of the
  identical subclass before its outer `super(title)`. Supporting that case
  requires a versioned explicit extension API, not another ambient heuristic.
- Extension consumers that need a live node's structural schema must use
  `nodeDefinition(node)` instead of the global type registry or inherited
  `constructor.nodeData`. Existing class-catalog metadata is unchanged.
- This changes construction ownership, not serialization, layout authority,
  promoted-widget registration, or the follower's one-way document contract.
