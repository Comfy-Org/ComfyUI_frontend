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
   type's resolver by type name; the definition's disposer removes it only if
   it is still the one that definition added.

### The seam

2. `graphToPrompt` takes an optional `frontendExecution` in its options. Its
   type, `FrontendExecution`, is declared by the host in `executionUtil.ts`;
   the API implements it. `app.graphToPrompt`, through which every prompt the
   app builds passes (queueing, export, sharing), gives it
   `useComfyApiStore().frontendExecution`. `src/utils` does not import the API.
3. `graphToPrompt` calls `adoptNodes(nodes)` once, with the flattened map of
   executable nodes, after it is built and before any input is emitted. When
   no defined type has a resolver it returns at once, reading nothing.
   Otherwise each entry whose node's type has a resolver is replaced, under the
   same key, by a `ResolvedNodeDTO`: the API's subclass of `ExecutableNodeDTO`,
   made from the same node, path, map and subgraph node. Every other entry is
   left as it was, so a workflow with no resolved node builds the same prompt.
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
    ordinary widget, the element for a DOM widget), and gives a frozen copy;
    `undefined` for a name no widget has or a value that cannot be saved.
    `input(ref)` gives the `InputRef` of an input by index or by name (the
    first with it), `undefined` if there is none.
13. Each view method refuses an argument it cannot use with a `TypeError`: a
    type or widget name that is not text, an input that is neither a name nor
    an integer. Inside a resolver that is the resolver throwing, so it is
    reported as in decision 8.

## Left out

- `ResolveView.signal` (0 packs): cancellation for sandboxed resolvers.
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

## What this feature replaces or duplicates, and why

- **`applyToGraph`**: `resolve` replaces it for API packs. It is untouched for
  legacy packs, and so is LiteGraph's pass-through for a frontend node with no
  resolver, which a resolved node falls back to.
- **The DTO walk**: `ResolvedNodeDTO` reuses it. It overrides only the public
  `resolveOutput`, passes the walk's `visited` set on as `ExecutableNodeDTO`
  asks of an override, and calls the host's `resolveInput` for every forward.
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
  `graphToPrompt`'s options and calls `adoptNodes` once; `app.ts` passes the
  store's. Each has a test that fails without it (`executionUtil.test.ts`,
  `app.test.ts`), and a workflow with no resolved node builds the same prompt
  with and without the API.
- A caller of `graphToPrompt` that does not pass the option builds without
  resolution. Every prompt the app builds goes through `app.graphToPrompt`.
- A build with a resolver defined costs one map lookup per executable node,
  and one view and one call per resolved node whose outputs are read.
- `ResolvedNodeDTO` depends on `ExecutableNodeDTO`'s public constructor and on
  `resolveOutput`, `resolveInput`, `nodesByExecutionId` and
  `subgraphNodePath`. A change to those in core is a change to this file.
- A resolver that edits the graph is not stopped; the contract says it must
  not.
