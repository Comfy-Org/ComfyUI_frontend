# ADR-SUBGRAPH-LIFETIME-0064: Own core work through callback completion

Date: 2026-11-27

## Status

Proposed

## Context

Receiving-definition resolution protects construction only while the selected definition remains owned. Extension callbacks can remove nodes or replace definitions synchronously. A constructed node can already reference its receiving graph without belonging to that graph's attached membership. Orphan discovery therefore cannot treat every constructed reference as live.

Core input listeners also schedule deferred widget work. Stopping a listener does not cancel work it already queued. Replacing an input must retire that input's work without stopping the node's other inputs.

Extensions observe host structure immediately after their base constructor returns. They also observe different configure and attachment ordering in clipboard import and follower recovery. Delaying all synchronization until attachment would change those observations.

## Decision

Keep immediate core synchronization and give it one node lifetime. Allocate the cancellation handle before invoking extension constructors so failure after the base constructor can still cancel core work. Input bindings have replaceable child lifetimes. Events and deferred effects use the same binding lifetime, including explicit retirement when an input disappears.

Core graph removal closes core subscription work independently of the extension-overridable removal hook. Extension callbacks remain extension callbacks, not the sole owner of mandatory core disposal. Cancellation of an unattached construction does not invoke arbitrary removal hooks.

Required legacy expansion owns its construction receipts through its callback-bearing work and exceptional exits. A completed construction is not completed expansion. Validate receiving ownership and exact membership before destructive completion, including members created earlier in the operation. Ordinary paste keeps its independent partial-success contract.

Expected availability refusal happens before constructors. Interference after callbacks begin is a different outcome: retaining the original and cleaning up operation-owned objects does not imply that unrelated graph changes or external effects were undone. Cleanup must preserve shared definitions and must not remove a same-ID replacement owned by another callback.

## Alternatives and consequences

- Attachment-only listeners miss structural changes that extension constructors observe synchronously. Preserving immediate synchronization avoids requiring an extension migration.
- Linking listener signals alone leaves queued effects alive. Binding-generation cancellation covers both subscriptions and deferred effects while preserving same-generation reconnect behavior.
- A mandatory call to the base removal hook would leave core correctness dependent on extension cooperation. Core-owned disposal permits extension overrides without granting them ownership of core subscriptions.
- Returning raw receipts from a generic importer distributes callback validation and cleanup among consumers. A required expansion operation keeps those obligations with the operation that performs the destructive edits.
- Required expansion still constructs all members before attaching any. Sequential attachment followed by compensation spends allocation IDs and emits callbacks before a later constructor failure, so it cannot preserve the existing unchanged-serialization guarantee. Eager staging stays private to this operation rather than becoming an importer mode.
- Global definition leases or writer locks require a shared contract for reentrant definition mutation. This operation instead detects changed ownership around callbacks. Identity checks do not detect a released definition object reinserted into the registry; preventing that resurrection requires a separate writer/lifetime contract.
- Direct conversion of serialized group data into a final subgraph could remove temporary live nodes, but would change callback-visible graph identity, ordering, and constructor counts. That alternative needs separate compatibility proof.
- This decision does not make arbitrary extension effects transactional, change serialization identity, or unify clipboard and follower insertion order. Widget ownership still requires its existing teardown behavior; subscription cancellation alone is not widget disposal.
