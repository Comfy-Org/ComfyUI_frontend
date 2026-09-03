# Execution, queueing, and frontend resolution

The execution API separates permanent graph edits, prompt-time resolution,
queue submission, and backend results. Keeping those stages distinct prevents a
pack from mutating the live document merely to construct a prompt.

## Queueing a run

```js
const submitted = await comfy.queue.run()
```

`run()` behaves like the host Run action. It resolves when submission finishes,
not when backend execution completes. `false` means another queue call was
already in flight and this call was folded into it.

Run part of the graph with explicit output nodes:

```js
await comfy.queue.run({
  nodes: comfy.graph.selection(),
  batch: 2
})
```

The host includes the dependencies that feed those nodes. An empty `nodes`
array is rejected rather than interpreted as “run everything.”

## Queue lifecycle

### Before submission

```js
const stop = comfy.queue.onBeforeRun(() => {
  const restore = preparePromptState()
  return () => restore()
})
```

The listener runs before the prompt is built. It must be synchronous; the
prompt builder does not await work started here.

A returned cleanup runs when the attempt ends whether it was submitted,
rejected, canceled, or threw. This pairing exists for legacy behavior that must
temporarily change graph state and restore it, but prefer `beforeSerialize`, a
frontend resolver, or a supplier when those express the intent without graph
mutation.

### After submission

```js
const stop = comfy.queue.onAfterRun((event) => {
  console.info(event.promptIds)
  console.info(event.submissions)
  console.info(event.rejected)
})
```

`onAfterRun` means the submission attempt finished. It is not an execution-
complete event. Accepted submissions include prompt IDs and backend node counts;
`rejected` reports how many submissions the backend refused.

### Validation rejection

```js
const stop = comfy.queue.onRejected(({ status, error, nodeErrors }) => {
  reportValidationFailure(status, error, nodeErrors)
})
```

This event covers a prompt the backend rejects before execution begins. It
includes the top-level error and per-node input validation details. It does not
represent a transport failure or an exception raised after execution starts.

## Guarding a run

Use a guard when the decision may be asynchronous and must be made before the
prompt is built:

```js
const stop = comfy.queue.guard(async () => {
  const answer = await comfy.ui.prompt({
    label: 'Estimated cost is high. Type RUN to continue.'
  })
  return answer === 'RUN'
})
```

Every registered guard runs; any `false` cancels the attempt. A guard that
throws is treated as allowing the run. All guards share a short host timeout,
after which the run proceeds so one extension cannot make ComfyUI permanently
unrunnable. Do not place an indefinitely blocking dialog behind a guard.

`onBeforeRun` observes and prepares. `guard` can delay and cancel. Do not use one
as an approximation of the other.

## Queue state and interruption

```js
const count = comfy.queue.pending()
const stopPending = comfy.queue.onPendingChanged((next) => updateCount(next))

await comfy.queue.interrupt()
const stopInterrupted = comfy.queue.onInterrupted(() => releaseWaiters())
```

`pending()` includes the currently executing run. `interrupt()` stops that run;
it does not clear the remainder of the queue.

The API also exposes the host's user-facing queue settings:

```js
comfy.queue.autoQueueMode() // 'disabled' | 'change' | 'instant'
comfy.queue.setAutoQueueMode('change')
comfy.queue.batchCount()
comfy.queue.setBatchCount(4)
comfy.queue.disableAutoQueue()
```

Use `disableAutoQueue()` before a self-interrupting conditional workflow so the
automatic runner does not immediately submit it again.

## Observing backend execution

The root API resolves backend execution IDs, including nested subgraph paths:

```js
const current = comfy.executingNode()
const node = comfy.executionNode(executionId)

const stop = comfy.onExecutingNodeChanged((next) => {
  updateRunningBadge(next)
})
```

`executingNode()` is `undefined` between nodes and runs. Use
`executionNode(id)` instead of parsing nested execution IDs or looking up the
visible graph by the final numeric segment.

For results, register behavior on the node definition:

```js
comfy.defs.extend('MyPack/Analyzer', (definition) => {
  definition.onExecuted((node, result) => {
    console.info(result.images, result.text, result.raw)
  })

  definition.onPreview((node, frame) => {
    showPreview(node, frame.url)
  })
})
```

`ExecutionResult.raw` preserves custom output keys from the pack's own backend.
`PreviewFrame.url` is an object URL revoked when the next frame arrives; copy or
consume it before retaining a preview beyond that lifetime.

## Frontend-only nodes

Frontend nodes remain ordinary editor entities but do not execute on the
backend. Define one with `execution: 'frontend'`, or mark a backend-defined type
with `NodeDefBuilder.setExecution('frontend', resolver?)`.

A resolver answers what each of its own outputs means:

```js
comfy.defs.define({
  type: 'MyPack/Reroute',
  inputs: [{ name: 'in', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve({ self }) {
    const input = self.input('in')
    return {
      out: input ? { forwardTo: input } : { omit: true }
    }
  }
})
```

Each output name maps to one `OutputResolution`:

```js
{
  omit: true
}
{
  forwardTo: inputRef
}
{
  literal: value
}
```

The resolver receives a frozen `ResolveView`:

- `self` gives the resolver's ID, type, properties, groups, mode, color, own
  inputs and outputs, and widget values;
- `nodesOfType(type)` returns other frozen views in the same graph scope;
- `self.input(nameOrIndex)` creates the only reference a resolver may forward.

Resolution follows chains to a physical backend output, literal, or omission,
with cycle detection. A resolver must be pure. It may return its result directly or as a promise; async resolvers run concurrently, receive an `AbortSignal` on the view, and are abandoned at the resolution deadline, so an awaited call that never settles cannot stall the prompt. It cannot edit
the graph or a prompt draft.

`InputSlotHandle.resolvedSource()` exposes the same final result for editor
behavior without changing topology.

## Suppliers and broadcast behavior

A supplier is the supply-side counterpart to a resolver. It answers which
unconnected inputs elsewhere in the same graph this node offers to feed:

```js
comfy.defs.extend('MyPack/BroadcastModel', (definition) => {
  definition.setSupply(({ self, unconnectedInputs }) => {
    const output = self.outputs.find(({ name }) => name === 'MODEL')
    if (!output) return []

    return unconnectedInputs()
      .filter((input) => input.type === 'MODEL')
      .map((input) => ({
        to: { nodeId: input.nodeId, input: input.input },
        from: { output: output.index },
        priority: 10
      }))
  })
})
```

A supplied source can be:

- one of the supplier's own outputs;
- a literal;
- whatever feeds one of the supplier's own inputs (`forwardInput`).

It cannot name an arbitrary third-party node as a source. A supplier may offer
what it owns, not rewire two bystanders.

`unconnectedInputs()` exposes matching data needed by real broadcast packs:
slot name, translated label, type, widget-input status, owner title/mode/color,
groups, and frozen owner properties.

When multiple suppliers claim one input, higher priority wins. Exact priority
ties feed nothing instead of making execution depend on graph order.

Resolution runs independently in each graph scope. It never crosses a subgraph
boundary.

## Inspecting winning supplies

```js
for (const edge of comfy.graph.resolvedSupplies()) {
  if (edge.supplierNodeId !== broadcaster.id) continue
  if (edge.from.kind !== 'output') continue

  broadcaster.outputs
    .at(edge.from.output)
    ?.connectTo(edge.to.nodeId, { index: edge.to.input })
}
```

This recomputes the same pure resolver and priority arbitration prompt execution
uses. It is the safe basis for a command such as “convert virtual broadcasts to
real links”; reimplementing matching in the pack can create links the prompt
would not use.

The returned IDs are local to that graph scope. `GraphScopeHandle` offers the
same read for root or subgraph definitions.

## Prompt-time widget serialization

Frontend resolution changes topology. A widget's `beforeSerialize` changes one
value for one destination:

```js
widget.on('beforeSerialize', (event) => {
  if (event.context === 'prompt') {
    event.setSerializedValue(resolveTemplate(String(event.value)))
  }
})
```

Use this for sentinel expansion, prompt templates, rolled seeds, or embedded
reproduction data. It is synchronous and does not mutate the live widget.

Do not edit the built prompt or workflow snapshot. Use partial queue execution,
frontend resolution, supply, widget serialization, and ordinary graph commands
for the supported intents those internal edits previously combined.
