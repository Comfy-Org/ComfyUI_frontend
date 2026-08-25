# Connection Callbacks Migration Notes

Covers `onConnectionsChange`, `onConnectInput`, `onConnectOutput`,
`onBeforeConnectInput`, and the graph-level node lifecycle events these
callbacks fire alongside, following the ECS data-centralization refactor.
For input-replacement ordering and `LinkNetwork` API changes, see
[Link registration migration](link-registration-migration.md). This note
does not repeat that content.

## Callback surface and signatures are unchanged

`node.onConnectionsChange`, `node.onConnectInput`, `node.onConnectOutput`,
and `node.onBeforeConnectInput` remain declared with their existing
signatures in `src/lib/litegraph/src/LGraphNode.ts:784-845`. `onConnectInput`
and `onConnectOutput` still run before a link exists and can veto the
connection by returning `false`
(`src/lib/litegraph/src/LGraphNode.ts:3130-3149`); `onConnectionsChange`
still fires after the topology store is updated, with the same
`(type, index, isConnected, link_info, inputOrOutput)` shape. Nothing about
these hooks required a compatibility shim: no `onConnectionsChange`- or
`onConnectInput`/`onConnectOutput`-specific shim exists in the codebase.

Subgraph boundary crossings (`SubgraphInput`, `SubgraphOutput`,
`SubgraphInputNode`) fire the same `onConnectionsChange` callback, but pass a
`SubgraphIO` object instead of a normal `INodeInputSlot`/`INodeOutputSlot` as
the fifth argument
(`src/lib/litegraph/src/subgraph/SubgraphInput.ts:136`,
`SubgraphOutput.ts:86,147`, `SubgraphInputNode.ts:228`). Callbacks that assume
a plain slot object should check for this.

## New: typed graph lifecycle events

`graph.events` now dispatches `node:added`, `node:before-removed`, and
`node:removed` (`src/lib/litegraph/src/infrastructure/LGraphEventMap.ts:60-78`).
These are additive: `node.onAdded`, `node.onRemoved`, and the single-slot
`graph.onNodeAdded`/`onNodeRemoved` callbacks remain and fire as before, but
the new events support multiple subscribers without clobbering each other,
which matters if more than one extension (or first-party system) wants to
observe add/remove around the same node. Prefer these events over
`onNodeAdded`/`onNodeRemoved` when you don't need to veto or mutate, since a
second subscriber assigning `graph.onNodeAdded` will silently replace the
first's handler.

There are no equivalent multi-subscriber events for connect/disconnect;
`onConnectionsChange` is still the only per-connection hook.

## Node removal: exact callback order

For `graph.remove(node)` (`src/lib/litegraph/src/LGraph.ts:1248-1319`):

1. `node:before-removed` dispatches while the node is still fully attached.
2. Every connected input and output is disconnected, firing
   `onConnectionsChange(..., false, ...)` on the removed node **and** on each
   peer node still holding the other end of a link. At this point the
   removed node is still in `graph._nodes_by_id` and `node.graph` is still
   set.
3. Floating links touching the node are removed.
4. `node.onRemoved()` runs; `node.graph` is still non-null here.
5. The node is detached from stores/layout, `node.graph` is set to `null`,
   and it is removed from graph indexes.
6. `onNodeRemoved(node)` and then `node:removed` fire; both observe an
   already-detached node absent from `getNodeById()`.

The practical guidance: if an `onConnectionsChange` handler on a _peer_ node
needs to resolve the node being removed via `graph.getNodeById()`, do it from
step 2, not from a `node:removed` listener. By then the node is gone. If
your own node needs to react to disconnects triggered by its own removal
before general node-removed cleanup runs, `onConnectionsChange` still fires
before `onRemoved`, same as before.

(Source: `docs/architecture/ecs/ecs-lifecycle-audit.md:66-80`, verified
against the code in `LGraph.ts` above.)

## Workflow load: links and node shells now precede configure

`LGraph.configure` registers links first, then creates every node shell
(`this.add(node, true)`) for the whole workflow, and only afterwards runs
`node.configure()` on each node in a second pass
(`src/lib/litegraph/src/LGraph.ts:2650-2732`). Because `LGraphNode.configure`
fires `onConnectionsChange` for each restored input/output
(`src/lib/litegraph/src/LGraphNode.ts:1085,1098`), this means: during
workflow load, when your `onConnectionsChange` callback fires for a restored
connection, every peer node already exists in the graph and the link is
already registered in the topology store. `graph.getNodeById()` and link
lookups from inside that callback resolve correctly, rather than possibly
hitting a not-yet-created peer. This ordering is called out explicitly as
part of the compatibility contract in
`docs/architecture/ecs/ecs-lifecycle-audit.md:47-64`.

## Connect: a fired callback can be followed by a skipped one

`LGraphNode.connectSlots` re-checks that the new link still resolves to
itself in the store after each `onConnectionsChange` call, and skips the
remaining callback(s) for that connection if it doesn't
(`src/lib/litegraph/src/LGraphNode.ts:3195-3217`):

```ts
this.onConnectionsChange?.(NodeSlotType.OUTPUT, outputIndex, true, link, output)
if (graph.getLink(link.id) !== link) {
  graph.afterChange()
  return
}
inputNode.onConnectionsChange?.(
  NodeSlotType.INPUT,
  inputIndex,
  true,
  link,
  input
)
```

In practice: if the output-side `onConnectionsChange` handler itself mutates
the graph (e.g. disconnects the link it was just called about, or something
that reassigns the same link id), the input-side call for that same connect
is skipped rather than firing against stale state. Do not assume the
output-side and input-side `onConnectionsChange` calls for one `connect()`
always both fire. Check that the link you were handed is still the one
connected if you re-enter the graph from inside the callback. This guard is
directly observable in the source above; no dedicated unit test currently
exercises the skip path, so treat this as a documented code behavior rather
than a covered contract.

## Removed: `node:slot-links:changed` / `node:slot-errors:changed`

These graph trigger events, along with their emitters and event-map types,
were removed (`docs/architecture/ecs/ecs-extension-compatibility-audit.md:98-104`).
There is no compatibility shim or replacement event with the same name.
Extensions that subscribed to either string must migrate to one of:

- reactive queries against `linkStore` / `src/lib/litegraph/src/node/slotLinks.ts`
  (`inputHasLink`, `outputHasLinks`, `outputLinkIds`, etc.) for connectivity
  state, or
- `onConnectionsChange` when you need exact timing (i.e. to run code at the
  moment a specific slot connects or disconnects) rather than a reactive
  read.

## Connectivity callbacks see the store, not the deprecated mirrors

`input.link` and `output.links` are now deprecated, store-derived reads:
writes through them no longer drive topology (see
[Link registration migration](link-registration-migration.md)). The
`link_info` value your `onConnectionsChange`/`onConnectInput`/`onConnectOutput`
callbacks receive always reflects current `linkStore` state, even if other
code in the same extension is still reading the deprecated slot mirrors.
Prefer `slotLinks.ts` helpers or the callback arguments themselves over
`input.link`/`output.links` when reacting to a connection change.

## Not independently verified

This note describes the current implementation and the ECS audit docs'
account of it. This behavior has not been independently verified against
pre-refactor history: the claims above are sourced from the audits and
current code, not a side-by-side comparison. If your extension depends on
exact callback firing behavior not covered above, file a report with a
reproduction rather than assuming it is unchanged.
