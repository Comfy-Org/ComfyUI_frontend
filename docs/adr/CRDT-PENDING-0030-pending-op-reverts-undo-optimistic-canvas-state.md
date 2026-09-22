# ADR-CRDT-PENDING-0030: Revert rejected optimistic node additions

Date: 2026-09-19

## Status

Proposed

## Context

Human graph edits reach the canvas before `opSender.ts` sends them to the doc
host. A rejected `add_node` therefore left a node on the local canvas that did
not exist in the shared document.

Removing that node has two traps:

1. A late rejection may arrive after another node has reused the same ID.
2. `LGraph.remove` emits an actor-less layout deletion on a microtask. Mint
   suppression has ended by then, so the deletion can mint a `delete_node` for
   a node the host never accepted.

FE-2504 plans to remove store-first remote apply and every store-to-canvas
reconciliation pass. Transport settlement is still needed after that work.
Canvas compensation is not.

## Decision

`PendingOpTrackerEvent` carries the reverted ops. This lets the revert handler
identify an `add_node` without keeping a second copy of the ledger.

`createPendingRevertNodeRegistry` records the live `LGraphNode` when the op is
minted. A rejection removes that object only. If the ID now belongs to another
node, the handler leaves it alone.

Removal uses `LGraph.remove` under `layoutStore.withActor` and
`runMintPortsSuppressed`. The actor stamp survives the deferred layout
delivery and prevents a new `delete_node` from being minted.

`unconfirmed` means delivery is unknown. It does not trigger a revert. The
tracker keeps the pending entry, and the sender keeps enough correlation to
process a late result. Only a host rejection can undo the optimistic edit.

The user receives one warning per microtask turn. The warning says the edit was
undone only when the node was actually removed.

## Limits

This change reverts `add_node` only. Reverting `connect`, `set_widget`,
`delete_node`, or `clear` requires prior state that the ledger does not hold.
Do not grow `pendingOpRevert.ts` into an inverse-operation framework. That
would add more of the reconciliation machinery FE-2504 is removing.

The local removal bypasses undo history. Any later edits attached to the
rejected node disappear with it. The host never accepted the node, so keeping
those edits would preserve a graph that cannot converge.

## FE-2504 deletion boundary

Delete `pendingOpRevert.ts`, its actor and suppression wiring, and its
layout-store test when both of these are true:

- local and remote Agent operations use one provenance-aware `LGraph` path;
- no store-to-canvas reconciliation pass remains.

Keep the ledger for operation identity, retries, acknowledgements, late
results, and authoritative-effect correlation.

## Tests

- `pendingOpRevert.test.ts` covers exact-node identity and removal outcomes.
- `pendingRevertRemovalMintSafety.test.ts` proves deferred removal does not
  mint another operation.
- `agentCrdtRejectedNodeAdd.spec.ts` covers the full browser path.
