# ADR-EXTENSIONS-NODE-API-0076: How a node type takes part in building a prompt

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0071](EXTENSIONS-NODE-API-0071-node-definitions-and-hooks.md)
lets a pack define a node type that runs in the frontend
(`execution: 'frontend'`): the prompt builder leaves its nodes out. Many such
types are wires: a Get node stands for whatever feeds the Set node of the same
name, a reroute stands for whatever feeds its input, a switch stands for one of
its inputs or for a constant. Today a pack does this with LiteGraph's
`applyToGraph`, which writes links and widget values into the live graph while
the prompt is serialised, or with `getInputLink` and `resolveVirtualOutput` on
its node class. In the census of the old contract, `NodeDefinition.resolve` is
used by 6 packs at 7 sites, all on frontend types.

The prompt builder is `graphToPrompt` in `src/utils/executionUtil.ts`. It
flattens the document into one `ExecutableNodeDTO` per node per subgraph
placement, keyed by execution id (`3:7` is node 7 inside the placement of
subgraph node 3), and asks each consumer's DTO `resolveInput(i)`. That walk
follows links through bypassed nodes, out of and into subgraphs, and to the
value of a promoted widget when a subgraph input has no link. A frontend node
without a resolver is handled there too: LiteGraph passes its input `k` through
to its output `k` (`getInputLink`), or gives nothing.

A second kind of pack feeds other nodes. cg-use-everywhere broadcasts a value
into every input of a matching type that no link feeds; today it writes real
links into the graph before the prompt is serialised and removes them after.
In the census `NodeDefBuilder.setSupply` is used by that pack, which also reads
the supplies back (`resolvedSupplies`) to turn them into real links on request.
Two more hooks belong here: `onPromptSerialize` (1 pack) leaves some of a
node's inputs out of the prompt, and `onPreview` (1 pack) hears the preview
images the server sends while a node runs.

Review finding B-10 of the earlier attempt asks that no API behaviour or state
be put on `LGraphNode` or `ExecutableNodeDTO`, and that the prompt builder ask
the API through one explicit seam. Finding B-09 asks that a resolver forwarding
to a subgraph input fed by a widget produce the widget's value.

## Decision

### Where a resolver comes from

1. `define(definition)` takes `resolve`, a function, only on a frontend type
   (`execution: 'frontend'`, which is `define`'s default). Anything else is
   refused with a `TypeError` before the type is registered: a `resolve` that
   is not a function, or a `resolve` with `execution: 'backend'`, whose nodes
   would both reach the prompt and stand for something else. The definition registry keeps each defined
   type's resolver by type name, and gives it only for a node made from the
   class that definition registered, so a class a legacy pack registers over
   the type later is not resolved by it. The definition's disposer removes the
   resolver only if it is still the one that definition added.

### The seam

2. `graphToPrompt` takes an optional `frontendExecution` in its options. Its
   type, `FrontendExecution`, is declared by the host in `executionUtil.ts`;
   the API implements it. `app.graphToPrompt`, through which every prompt the
   app builds passes (queueing, export, sharing), gives it
   `useComfyApiStore().frontendExecution`. `src/utils` does not import the API.
3. `graphToPrompt` calls `adoptNodes(nodes)` once, with the flattened map of
   executable nodes, after it is built and before any input is emitted. When
   no defined type has a resolver and no applied extension has a supplier
   (decision 14), it returns at once, reading nothing.
   Otherwise each entry whose node's type has a resolver is replaced, under the
   same key, by a `ResolvedNodeDTO`: the API's subclass of `ExecutableNodeDTO`,
   made from the same node, path, map and subgraph node (and each entry with a
   fed input by a `SuppliedNodeDTO`, decision 19). Every other entry is left
   as it was, so a workflow with no resolved or fed node builds the same
   prompt.
   Nothing under `src/lib/litegraph` changes and no field is added to a node.

### Resolving an output

4. The host asks an output of a node through `resolveOutput`. A
   `ResolvedNodeDTO` whose node is muted or bypassed gives the host's answer:
   nothing for a muted node, the matching input for a bypassed one. For a node
   that runs, it asks the node's resolver for its answer and follows it:
   - `{ omit: true }`: nothing feeds the consumer's input, so the prompt leaves
     it out.
   - `{ literal }`: the value, in the form the host gives a widget's value, so
     a list is wrapped as a list widget value is. Each consumer gets its own
     unfrozen copy.
   - `{ forwardTo: { nodeId, input } }`: whatever feeds that input, found by
     asking the DTO of that node in the same placement for `resolveInput`. The
     host's rules then apply as for any link: other resolved nodes, bypassed
     nodes, subgraph boundaries, and the value of a promoted widget for a
     subgraph input with no link (B-09).
   - an output the answer does not name: the host's answer, as if the node had
     no resolver.
5. An `InputRef` names a node of the resolver's own graph. The map is keyed by
   execution id, so in a subgraph placed twice each placement's consumers are
   fed from that placement's sources. No id is looked up in the graph on
   screen (B-01).
6. A resolver is asked at most once per node in a build, the first time one of
   its outputs is needed; a node whose outputs nothing in the prompt reads is
   not asked. Its answer serves every placement, because it sees only its own
   graph.
7. A cycle through resolvers (a Get node fed by the Set node it stands for)
   reaches the same input twice, and the host's guard in `resolveInput` fails
   the build with its `RecursionError`, as it does for a cycle of links.

### Failure

8. The resolver's call and the check of its answer run in one listener
   isolation (ADR-EXTENSIONS-NODE-API-0070 decision 14). A resolver that
   throws, or whose answer is refused, is reported once with the event
   `resolve`, and the node is built as if it had no resolver. Other nodes are
   not affected. An answer is refused when it is not a plain object; when a
   key names no output (a key is an output index written in decimal, or else
   the name of an output, the first with that name) or names an output twice;
   or when a resolution is not exactly one of `{ omit: true }`,
   `{ forwardTo }` and `{ literal }`. A `forwardTo` must be
   `{ nodeId, input }`, naming a node of the graph and one of its inputs by
   index. A literal must be a `WidgetValue` a workflow can save, checked and
   copied by the widget layer's `savableValue`: text, a finite number, a
   boolean, `null`, or a plain object or list of those.
9. Resolvers are synchronous. Nothing waits for them and nothing cancels them:
   the deadline and the `signal` existed for resolvers running in a sandbox.

### What a resolver sees

10. `ResolveView` is `self`, the resolved node, and `nodesOfType(type)`, the
    nodes of a type in the resolved node's own graph, in the graph's order.
    Both give `ResolvedNodeView`s: one per node per build, frozen, whose
    `properties`, `groups`, `inputs` and `outputs` are read the first time
    they are asked for and then kept.
11. A view gives the node's `id`, `type`, `mode` (a name, as
    `NodeHandle.getMode`), `color`, a frozen copy of its `properties`, the
    `groups` whose rectangle holds the node's centre (the rule of
    `GroupHandle.nodes`) in draw order, and its `inputs` and `outputs`. An
    input gives its index, name, the name the editor shows (label, else
    localized name, else name), and the type and source node of its link. A
    link from a subgraph's own input gives that input node's id, as
    `LinkInfo.sourceNodeId` does.
12. `widgetValue(name)` reads the widget's `value`, the accessor through which
    the host's widget value owner is reached (the widget value store for an
    ordinary widget, the widget's `getValue` option for a DOM widget), and
    gives a frozen copy;
    `undefined` for a name no widget has or a value that cannot be saved.
    `input(ref)` gives the `InputRef` of an input by index or by name (the
    first with it), `undefined` if there is none.
13. Each view method refuses an argument it cannot use with a `TypeError`: a
    type or widget name that is not text, an input that is neither a name nor
    an integer. Inside a resolver that is the resolver throwing, so it is
    reported as in decision 8.

### Supply

14. `NodeDefBuilder.setSupply(supplier)` adds a supplier to a type through
    `extend`, so it reaches the backend types a pack's Python registers, which
    `define` refuses. It is refused with a `TypeError` if it is not a function,
    and, like every builder method, once the `extend` callback has returned.
15. When a prompt is built and some applied extension has a supplier, each
    graph's suppliers are asked once in the build, the first time a node of
    that graph is adopted: every node of the graph that is not muted or
    bypassed is asked by each supplier of its type, with a `SupplyView` of
    `self` and `unconnectedInputs()`. As for every hook found by type name
    (ADR-EXTENSIONS-NODE-API-0071 decision 17), a node is asked only if its
    class, or one it extends, is a class the API put dispatchers on.
16. `unconnectedInputs()` lists every input that no link feeds, of the nodes of
    the graph that the host does not mark virtual (`isVirtualNode`), in the
    graph's order and then the inputs' order. It is built once per graph per
    build and shared by its suppliers; an entry's `nodeGroups` and
    `nodeProperties` are read from the node's view when first asked for.
    Virtual nodes are frontend nodes and subgraph nodes. Frontend nodes are
    left out because the prompt does not run them. Subgraph nodes are left out
    because the host reads an unlinked input of a subgraph node, from inside
    the subgraph, as its promoted widget, and never asks the subgraph node for
    it.
17. An answer is a list of edges. An edge has `to`, `from` and optionally
    `priority`, and nothing else. `to` is exactly `{ nodeId, input }` of one of
    `unconnectedInputs()`. `from` is exactly `{ output }`, an index of the
    supplier's outputs, or `{ forwardInput }`, an index of its inputs.
    `priority` is a finite number and defaults to 0. An answer with any edge
    that breaks these is reported with the event `setSupply` and dropped
    whole, as is a supplier that throws; the other suppliers still feed.
18. For each input, the highest claim feeds it. Claims at that priority from
    the same supplier with the same source count as one. Two different claims
    at the highest priority feed nothing, and the conflict is reported as a
    warning (`node_api_supply_conflict`, naming the input), because choosing
    either would make the prompt depend on the order of the nodes.
19. The entry of each node with a fed input is replaced, as in decision 3, by
    a `SuppliedNodeDTO`, which overrides only `resolveInput`. A fed input
    resolves to the supplier's executable node in the same placement:
    `resolveOutput` of the output, or `resolveInput` of the forwarded input,
    with the fed input's type. The host's rules then apply, as for a link: a
    resolved supplier gives its resolver's answer, a bypassed node whose input
    is fed passes it on, a forwarded input that comes from a subgraph's input
    gives each placement its own source, and a cycle fails the build with the
    host's `RecursionError`. A fed widget input replaces the widget's value in
    the prompt, as a link to it does.

### Reading supplies back

20. `resolvedSupplies()` on `comfy.graph` (the graph on screen) and on a
    `GraphScopeHandle` (its own graph, found through the handle, B-01) asks
    that graph's suppliers again, arbitrates as in decision 18, and gives each
    winning supply in the order of the inputs it feeds, frozen: the supplier,
    the input, and the source in the graph. `undefined` with no graph on
    screen, or for a scope that is gone.
21. The source is the output a link from it would start at: an output of the
    supplier, or the output that feeds its forwarded input, followed through
    frontend nodes whose resolvers answer and that are not muted or bypassed.
    A forward is followed to the link of the input it names; a literal gives
    `{ kind: 'literal' }` and an omitted output `{ kind: 'omitted' }`. An input
    no link feeds, a link from the subgraph's own input, and a cycle give
    `{ kind: 'omitted' }`, since no link in the graph can start there. Any other
    node, a bypassed or subgraph node included, gives its own output.

### Leaving inputs out of the prompt

22. `NodeDefBuilder.onPromptSerialize(callback)` is asked while a prompt is
    built, for each entry a node of the type has in it (once per placement of
    a subgraph), with the node's handle in its own graph, for a node made from
    a class the API put dispatchers on, as in decision 15. It is the second
    member of the seam: after `graphToPrompt` has filled an entry's inputs, it
    asks `omittedInputs(node)` and deletes each name the hooks give. Names the
    entry does not have change nothing, and the saved workflow keeps every
    input. Nodes the prompt leaves out (frontend, muted, bypassed) are not
    asked. With no such hook applied it gives no names without looking at the
    node.
23. A hook answers nothing, which leaves nothing out, or exactly
    `{ omitInputs }`, a list of names. Any other answer, and a hook that
    throws, is reported with the event `onPromptSerialize`, and that hook
    leaves nothing out; the other hooks' names are still left out. The hook is
    synchronous: the old contract awaited it only so that a sandboxed pack
    could answer.

### Previews

24. `NodeDefBuilder.onPreview(callback)` hears each preview image the server
    sends for a node of the type while it runs, for a node made from a class
    the API put dispatchers on, as in decision 15. The host's handler of
    `b_preview_with_metadata`, once it has found that the frame belongs to the
    run of the open workflow and stored it, calls
    `useComfyApiStore().deliverPreview(rootGraph, executionId, blob)` with the
    frame's display node. The API finds the node from the root graph by its
    execution id, so a node inside a subgraph is found in its own graph
    whether or not it is on screen, and calls the hooks of its type with the
    node's handle and a frozen `{ blob }`. A frame of another workflow's run is
    not delivered. With no such hook applied the call returns at once. A frame
    sent without metadata (`b_preview`) names no node and is not delivered.

## Left out

- `ResolveView.signal` and `SupplyView.signal` (0 packs each): cancellation
  for sandboxed resolvers and suppliers.
- `SupplyView.nodesOfType` (0 packs).
- `SuppliedEdge.from.literal` (0 packs). The census also counts 0 for
  `from.output` and `from.forwardInput`, because the one supplier builds
  `from` in an untyped helper; its source uses both, so both are kept.
- `ResolvedSource.value` and `ResolvedSource.reason` (0 packs). The one reader
  checks `kind` and reports any kind but `'output'`.
- `NodeDefinition.supply` and `NodeDefinition.onPromptSerialize` (0 packs
  each), as ADR-EXTENSIONS-NODE-API-0071 decision 38 records.
- `PreviewFrame.url` (0 packs). An object URL needs an owner to revoke it; a
  pack that wants one makes it from `frame.blob` with `URL.createObjectURL`
  and revokes it itself.
- `OwnInput.type` and `OwnInput.connected` (0 packs each): `connectedType` and
  `sourceNodeId` are `undefined` exactly when no link feeds the input.
- Asynchronous resolvers: no stored pack needs one, and the sandbox that did
  is out.

## Alternatives considered

- A flag on `LGraphNode` that `ExecutableNodeDTO.resolveOutput` branches on, as
  the earlier attempt had. That is API state on a LiteGraph class (B-10).
- A predicate passed into the DTO's resolution from `graphToPrompt`. It needs a
  new parameter on `ExecutableNodeDTO`, a change in core.
- `resolveVirtualOutput` and `getInputLink` on the API's own node class. They
  cannot give a literal, cannot tell "omit" from "pass through", and
  `resolveVirtualOutput` finds its source's DTO by node, so a subgraph placed
  twice resolves from its first placement. It also puts the API's behaviour on
  a node class.
- Resolve every resolved node first into a map of sources and substitute while
  emitting inputs, as the earlier attempt did. That is a second walk beside the
  DTO's, which has to repeat its rules for bypass, subgraph boundaries and
  promoted widgets; the earlier attempt's B-09 defect was a rule it missed.
- Let `graphToPrompt` import the API store. That makes `src/utils` depend on
  the API; the option keeps the dependency in `app.ts`, which already holds the
  store.
- Ask every resolver before the build. It runs packs' code for nodes nothing
  reads.
- Keep `applyToGraph`. It changes the live graph while the prompt is
  serialised, so a resolver that throws half way leaves the document changed.
- Feed supplied inputs in `graphToPrompt`'s input loop when `resolveInput`
  gives nothing, as the earlier attempt did. The host's walk never comes back
  to that loop from inside itself, so an input fed into a bypassed node or
  behind a forward would be missed; and `resolveInput` gives nothing for a
  linked input whose source is muted too, which the loop would have to tell
  apart.
- Let each supplier settle its own conflicts. Two packs' suppliers cannot see
  each other's claims.
- Feed the inputs of subgraph nodes. The host reads such an input from inside
  the subgraph, through the subgraph's input node; feeding it would need a
  second copy of that part of the walk.

## What this feature replaces or duplicates, and why

- **`applyToGraph`**: `resolve` replaces it for API packs. It is untouched for
  legacy packs, and so is LiteGraph's pass-through for a frontend node with no
  resolver, which a resolved node falls back to.
- **The DTO walk**: `ResolvedNodeDTO` reuses it. It overrides only the public
  `resolveOutput`, passes the walk's `visited` set on as `ExecutableNodeDTO`
  asks of an override, and calls the host's `resolveInput` for every forward.
- **Materialising links**: cg-use-everywhere's own pass that wrote links into
  the graph before serialisation and recorded them to undo afterwards is
  replaced by suppliers; `resolvedSupplies` gives it what it needs to make
  real links when the user asks for them.
- **Preview routing**: packs listened to the API client's preview events and
  kept the running node in a global to tell whose frame it was. `onPreview`
  uses the host's handler, its display node and its check of the workflow,
  and finds the node with the host's `getNodeByExecutionId`.
- **Copying**: a literal is checked and copied by `savableValue`, the check
  the widget layer applies to every value a pack gives a widget, so a literal
  and a widget value are refused for the same reasons. A view's `properties`
  use `savedCopy` in `nodeApi/shared/savedCopy.ts`, the JSON copy and deep
  freeze `savedCopier` already made, split out so that it throws instead of
  giving `undefined`: a prompt build has already saved the properties, so they
  can always be copied there.
- **Reads**: the mode names and node bounds come from `nodeHandle.ts`
  (`MODE_NAMES`, `boundsOnCanvas`), the centre test from LiteGraph
  (`containsCentre`), the link of an input from `slotLinks.ts` (`inputLink`).
  A node's groups are computed per node rather than through `GroupHandle.nodes`,
  which lists a group's nodes as handles; the rule is the same.

## Consequences

- Host changes: `executionUtil.ts` declares `FrontendExecution`, takes it in
  `graphToPrompt`'s options, calls `adoptNodes` once and deletes the names
  `omittedInputs` gives from each entry; `app.ts` passes the store's, and its
  preview handler calls `deliverPreview`. Each has a test that fails without
  it (`executionUtil.test.ts`, `app.test.ts`), and a workflow with no resolved
  node builds the same prompt with and without the API.
- A caller of `graphToPrompt` that does not pass the option builds without
  resolution. Every prompt the app builds goes through `app.graphToPrompt`.
- A build with a resolver defined costs one map lookup per executable node,
  and one view and one call per resolved node whose outputs are read. With a
  supplier applied, each graph in the prompt also costs one call per running
  node of a type with suppliers (a pack that extends every type asks every
  node), one view per node asked, and one pass over the graph's inputs.
- `resolvedSupplies` asks the suppliers on every read.
- `graphToPrompt` asks `omittedInputs` once per prompt entry; with no
  `onPromptSerialize` hook applied the call returns at once.
- `ResolvedNodeDTO` and `SuppliedNodeDTO` depend on `ExecutableNodeDTO`'s
  public constructor and on `resolveOutput`, `resolveInput`, `inputs`,
  `nodesByExecutionId` and `subgraphNodePath`. A change to those in core is a
  change to these files.
- A resolver that edits the graph is not stopped; the contract says it must
  not.
