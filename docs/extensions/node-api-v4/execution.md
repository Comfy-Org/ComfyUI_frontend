# Frontend execution: resolve and supply

A frontend node is left out of the prompt. Two members say what it stands for
when a prompt is built. Both are synchronous, must not change the graph, and
see only frozen views of the node's own graph. One that throws or answers
wrongly is reported, and the prompt is built as if it were not there.

## Resolve

A type defined with `execution: 'frontend'` may have `resolve`. It answers,
by output index or name, what each output stands for: whatever feeds one of
the node's inputs (`forwardTo`), a value (`literal`), or nothing (`omit`). An
output the answer does not name is handled as if the node had no resolver.

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
comfy.defs.define(packId, {
  type: 'MyPack.Switch',
  inputs: [
    { name: 'on', type: '*' },
    { name: 'off', type: '*' }
  ],
  outputs: [{ name: 'out', type: '*' }],
  widgets: [{ type: 'toggle', name: 'enabled', value: true }],
  resolve(view) {
    const chosen = view.self.input(
      view.self.widgetValue('enabled') ? 'on' : 'off'
    )
    return { 0: chosen ? { forwardTo: chosen } : { omit: true } }
  }
})
```

`view.nodesOfType(type)` reads other nodes of the same graph, as a Get node
finds its Set node.

## Supply

`setSupply` feeds inputs no link feeds, of the nodes in the supplier's graph
that the backend runs.
It is added through `extend`, so it reaches backend types too. For each input
the highest `priority` wins; two different claims at the highest priority
feed nothing and are reported.

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
comfy.defs.extend(packId, 'MyPack.Broadcast', (builder) => {
  builder.setSupply((view) =>
    view
      .unconnectedInputs()
      .filter((input) => input.type === view.self.outputs[0]?.type)
      .map((input) => ({
        to: { nodeId: input.nodeId, input: input.input },
        from: { forwardInput: 0 }
      }))
  )
})

for (const supply of comfy.graph.resolvedSupplies()) {
  console.info(supply.supplierNodeId, supply.to, supply.from.kind)
}
```

## Leaving inputs out, and previews

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
comfy.defs.extend(packId, 'MyPack.Loader', (builder) => {
  builder.onPromptSerialize(() => ({ omitInputs: ['preview_only'] }))
  builder.onPreview((node, frame) => {
    const url = URL.createObjectURL(frame.blob)
    console.info(node.id, url)
    URL.revokeObjectURL(url)
  })
})
```

`onPromptSerialize` changes only the prompt; the saved workflow keeps every
input.
