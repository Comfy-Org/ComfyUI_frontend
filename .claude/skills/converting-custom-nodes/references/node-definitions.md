# Converting `beforeRegisterNodeDef` and prototype patching

**1,265 packs / 50.4M downloads / 47.4% of registry installs** register a
`beforeRegisterNodeDef` hook, and **1,191 of them use it to patch the generated
class's prototype**. This is the largest surface in the ecosystem — bigger than
the widget and painting cohorts combined — and the one that couples packs to our
internals most tightly.

## What they patch — measured

Prototype assignments across those 1,265 packs, litegraph methods only
(bundled-library noise like `_next`, `dispose`, `toString` filtered out):

| Patched method        | Sites | Packs   | Destination                    |
| --------------------- | ----- | ------- | ------------------------------ |
| `onNodeCreated`       | 3,161 | **943** | `b.onCreated(cb)`              |
| `onExecuted`          | 964   | **497** | `b.onExecuted(cb)`             |
| `onConfigure`         | 1,272 | **429** | `b.onConfigured(cb)`           |
| `onConnectionsChange` | 454   | 223     | `b.onConnectionsChanged(cb)`   |
| `onDrawForeground`    | 446   | 199     | `references/draw-callbacks.md` |
| `onRemoved`           | 353   | 158     | `b.onRemoved(cb)`              |
| `constructor`         | 473   | 49      | `b.onCreated(cb)`              |
| `getDefaultShape`     | 335   | 3       | no replacement — escalate      |

## The selector is already written — it's the guard clause

Every one of these hooks runs for **every registered node type**, so essentially
all of them open with a filter and return. That filter _is_ the selector:

```js
// before — ComfyUI-KJNodes jsnodes.js:37
async beforeRegisterNodeDef(nodeType, nodeData, app) {
  if (!nodeData?.category?.startsWith('KJNodes')) return
  switch (nodeData.name) {
    case 'ImageBatchMulti':
    case 'ImageAddMulti':
      nodeType.prototype.onNodeCreated = function () {
        setupDynamicInputs(this, { type: 'IMAGE', prefix: 'image_' })
      }
      break
    ...
  }
}

// after
comfy.defs.extend(['ImageBatchMulti', 'ImageAddMulti'], (b) => {
  b.onCreated((node) => setupDynamicInputs(node, { type: 'IMAGE', prefix: 'image_' }))
})
```

This is mechanical: lift the `if`/`switch` condition into the selector, one
`extend` call per case group.

It is also a real performance fix, not just tidiness. With 1,265 packs hooking
and a few thousand node types, boot currently runs **millions of callbacks that
immediately return**. A declarative predicate can be indexed.

Selector forms: exact type, array of types, `RegExp` over the type, or
`{ category }` where category is a string or a `RegExp`. The regex form covers
the prefix filter 53 packs open with —
`nodeData.category.startsWith('KJNodes')` becomes `{ category: /^KJNodes/ }`.

`onCreated` fires when the node **joins a graph**, not inside the constructor.
Litegraph's `onNodeCreated` runs before the node has an id, a graph, or store
registration, so widget writes made there are lost on insert. If a pack relied
on running before insertion, escalate — that ordering is not reproducible.

## Chaining boilerplate disappears

```js
// before — capture-and-chain, because prototype patching has no composition
const onExecuted = nodeType.prototype.onExecuted
nodeType.prototype.onExecuted = function (message) {
  onExecuted?.apply(this, arguments)
  populate.call(this, message.text)
}

// after — registered callbacks compose by construction
b.onExecuted((node, result) => populate(node, result.text))
```

Whether the old form worked at all depended on load order and on every pack
remembering to call through. Two packs patching the same method with one
forgetting silently broke the other.

## `onExecuted` — the second-largest, and easy to get wrong

497 packs. The result shape is now explicit rather than a raw backend payload:

```js
// before
nodeType.prototype.onExecuted = function (message) {
  populate.call(this, message.text)
}

// after
b.onExecuted((node, result) => populate(node, result.text))
```

`ExecutionResult` exposes `images`, `text`, and `raw` for everything else.
Custom output keys survive in `raw` — ADR 0007's passthrough schema guarantees
it — so a pack reading a bespoke key keeps working.

## A worked example touching four surfaces at once

ComfyUI-Custom-Scripts `showText.js:10` is representative of the harder cases:

```js
// before
async beforeRegisterNodeDef(nodeType, nodeData, app) {
  if (nodeData.name === 'ShowText|pysssss') {
    function populate(text) {
      if (this.widgets) {
        // On older frontend versions there is a hidden converted-widget
        const isConvertedWidget = +!!this.inputs?.[0].widget
        for (let i = isConvertedWidget; i < this.widgets.length; i++) {
          this.widgets[i].onRemove?.()
        }
        this.widgets.length = isConvertedWidget
      }
      for (const l of text) {
        const w = ComfyWidgets.STRING(this, 'text_' + this.widgets?.length, ...).widget
        widget element.readOnly = true
        widget element.style.opacity = 0.6
      }
    }
    ...
  }
}
```

Four separate conversions:

| Old                                                    | New                               |
| ------------------------------------------------------ | --------------------------------- |
| `nodeData.name === 'ShowText\|pysssss'` guard          | the `defs.extend` selector        |
| `+!!this.inputs?.[0].widget` converted-widget sniffing | `input.isWidgetInput`             |
| `this.widgets.length = n` truncation                   | remove by name (below)            |
| `widget element`                                       | `w.element` (renamed in PR #8594) |

Truncation has no single-call replacement, deliberately — assigning `length`
skips each widget's teardown, which is why the pack has to call `onRemove()` by
hand first:

```js
// after — removal runs teardown for you
for (const name of node.widgets.names().slice(keep)) {
  node.widgets.remove(name)
}
```

Note `isConvertedWidget` exists only to skip a widget the _old frontend_ hid via
the converted-widget protocol. With `setHidden()` as a real property, that
whole line of reasoning goes away — check `input.isWidgetInput` if you actually
care whether an input is a widget's socket form.

## Virtual node classes — `registerCustomNodes`

86 packs / 18.2% of installs define their own types, today via
`extends LGraphNode`. That is a genuine rewrite, not a mechanical edit, and it
includes rgthree and kjnodes.

**Not yet available** — `defs.define` is specified but unimplemented. Packs that
need it are an `api-gap` punt today. Recorded here so the shape is agreed:

```js
// before
class MyNode extends LGraphNode {
  constructor() { super(); this.addOutput('*', '*') }
  onConnectionsChange() { ... }
}
LiteGraph.registerNodeType('MyNode', MyNode)

// after
comfy.defs.define({
  type: 'MyNode',
  outputs: [{ name: '*', type: '*' }],
  onConnectionsChanged: (node, ev) => { ... }
})
```

Frontend-only nodes that rewrite the prompt (kjnodes `SetNode`/`GetNode` as
named wires, rgthree Fast Muter changing other nodes' modes) declare
`virtual: true` and implement `resolve(ctx)`. `resolve` runs against a **prompt
draft, never the live graph** — so a resolve pass that throws halfway cannot
leave the user's document mutated, which the old `applyToGraph` could.

## Traps

**The constructor self-assignment.** `this.type = this.type ?? undefined` is a
defensive no-op that now throws, killing construction entirely. Handled
mechanically by the `type-write-noop` rule — 8 packs, 3.86M downloads, including
rgthree's whole 12-type virtual-node family.

**`nodeData` is a definition, not a node.** Reading `nodeData.input.required.x`
is fine; it becomes `b.def.inputs`. But the shape differs — do not assume a
field-by-field rename.

**Async hooks.** `async beforeRegisterNodeDef` is common and usually gratuitous.
`defs.extend` is synchronous; if a pack genuinely needs async setup, do it in
`onCreated` and guard for the node being removed before it resolves.

**Order-dependent patches.** A pack that reads `nodeType.prototype.onNodeCreated`
expecting another pack's patch to already be installed has no equivalent, by
design. Escalate — it needs the author.

## Source data

Prototype-assignment counts derived from the corpus at
`~/comfy/nodes-compat-study/corpus/registry_js` (4,969 packs, 2,562 files
scanned). Grep-derived; sample-verify before citing an individual number.
