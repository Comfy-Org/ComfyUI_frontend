# Connection Callbacks Migration Notes

Callback signatures did not change. `onConnectionsChange`, `onConnectInput`,
`onConnectOutput`, and `onBeforeConnectInput` keep their existing arguments
and timing. For link registration and `LinkNetwork` API changes, see
[Link registration migration](link-registration-migration.md).

## Check for SubgraphIO at subgraph boundaries

At a subgraph boundary (a `SubgraphInput` or `SubgraphOutput`),
`onConnectionsChange` still fires, but its fifth argument is a `SubgraphIO`,
not the usual `INodeInputSlot`/`INodeOutputSlot`. Check for it before
treating the argument as a normal slot:

```ts
import { isSubgraphInput, isSubgraphOutput } from '@/lib/litegraph/src/litegraph'

onConnectionsChange(type, index, isConnected, link, slotOrIO) {
  if (isSubgraphInput(slotOrIO) || isSubgraphOutput(slotOrIO)) {
    // boundary crossing: slotOrIO is a SubgraphIO
    return
  }
  // slotOrIO is INodeInputSlot | INodeOutputSlot
}
```

## Subscribe to node lifecycle events with graph.events

`graph.events` dispatches `node:added`, `node:before-removed`, and
`node:removed`. Use these when more than one part of your extension needs to
observe a node being added or removed:

```ts
graph.events.addEventListener('node:added', (e) => {
  console.log('added', e.detail.node.id)
})
```

`node.onAdded`, `node.onRemoved`, and the single-slot
`graph.onNodeAdded`/`graph.onNodeRemoved` still work, but assigning
`graph.onNodeAdded` replaces any existing handler: a second subscriber
silently drops the first. Prefer `graph.events` unless you need to veto or
mutate during add/remove. There's no multi-subscriber equivalent for
connect/disconnect; `onConnectionsChange` is still the only per-connection
hook.

## Node removal fires callbacks in this order (partially tested)

Removing a node fires, in order:

1. `node:before-removed`: the node is still fully attached.
2. `onConnectionsChange(..., false, ...)` on the removed node and on each
   connected peer, while the removed node is still in the graph.
3. `node.onRemoved()`: `node.graph` is still set.
4. The node detaches from graph indexes and stores; `node.graph` becomes
   `null`.
5. `onNodeRemoved(node)`, then `node:removed`, both seeing an already-detached
   node.

Tests cover `node:before-removed → node.onRemoved() → onNodeRemoved(node)` and
separately verify that `node:removed` sees a detached node. The complete
sequence, including step 2, is observed from source rather than guaranteed by
one end-to-end test.

To resolve the removed node from a peer's `onConnectionsChange` handler, do it
at step 2 via `graph.getNodeById()`. By `node:removed`, the node is gone.

## Workflow load resolves peer nodes before onConnectionsChange runs

`graph.configure()` creates every node in the workflow before any node's own
`configure()` runs and fires `onConnectionsChange` for its restored links.
So when your `onConnectionsChange` callback fires during load, every peer
node already exists and its link is already registered, so `graph.getNodeById()`
and link lookups from inside that callback resolve correctly.

## Disconnecting inside the output callback skips the input callback

Connecting a link calls the output side's `onConnectionsChange` first, then
the input side's. If the output-side handler disconnects that same link (or
otherwise invalidates it) before returning, the input-side call is skipped:

```ts
onConnectionsChange(type, index, isConnected, link) {
  if (type === NodeSlotType.OUTPUT && shouldReject(link)) {
    this.disconnectOutput(index)
  }
}
```

Don't assume both sides always fire for one `connect()` call; check that the
link you were handed is still connected if your handler re-enters the graph.
This is observed behavior, not a tested contract: no test currently
exercises the skip path.

## Replace removed slot events

`node:slot-links:changed` and `node:slot-errors:changed` were removed, with
no replacement event of the same name. Migrate to:

- `node.isInputConnected()`, `node.isOutputConnected()`, or
  `node.getOutputNodes()` for a reactive read of connectivity state, or
- `onConnectionsChange` when you need to run code at the exact moment a slot
  connects or disconnects.

## Read connection state from callback arguments or node methods

`input.link` and `output.links` are deprecated: writes through them no
longer drive topology, and reads can drift from the current graph. Use the
`link_info` argument your callback already receives, or the `LGraphNode`
instance methods that read the link store directly —
`node.isInputConnected()`, `node.getInputLink()`, `node.isOutputConnected()`,
`node.getOutputNodes()` — not `input.link`/`output.links`.

These methods are backed by `inputHasLink()`, `outputHasLinks()`,
`outputLinkIds()`, `inputLink()`, and `outputLinks()` in `slotLinks.ts`, but
that module is internal: it isn't re-exported from `litegraph.ts`, so import
it directly at your own risk rather than treating it as supported extension
API. Prefer the node methods above.
