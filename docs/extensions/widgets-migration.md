# Widget System Migration Notes

Widget values now live in `widgetValueStore`, a Pinia store, instead of only
on the widget instance. `node.widgets` itself is unchanged in shape — still
an array of widget objects, still ordered, still enumerable — but it is now a
proxy-backed accessor rather than a plain instance property, and each
widget's identity in the store is derived from its name, not from its
position in that array.

## Widgets are keyed by `graphId:nodeId:name`, not by index or object identity

`WidgetId` is a branded string of the form `graphId:nodeId:name`
(`src/types/widgetId.ts`). Two consequences follow directly from the key
being derived rather than assigned:

- Two widgets on the same node cannot share a `name`. If your extension ever
  added widgets with duplicate names (relying on positional access into
  `node.widgets` to disambiguate them), the second registration collides with
  the first in the store.
- Renaming a widget after it is registered orphans its stored state: the
  store entry stays filed under the old `name`, while anything that derives
  the widget's id afterward (`widget.widgetId`, `src/lib/litegraph/src/widgets/BaseWidget.ts:136-141`)
  computes the new key. `BaseWidget.name` is currently a plain data field, not
  an accessor, so nothing intercepts the assignment to re-key the store for
  you. Avoid renaming a widget post-construction; if you must, re-register it
  explicitly rather than assuming the store follows the rename. A fix that
  turns `name` into a rename-aware accessor has been proposed but is not
  present in this codebase; verify against your checkout before relying on
  automatic re-keying.

## `node.widgets` can be `undefined`, and is a mutation-tracking proxy

`node.widgets` is defined via `Object.defineProperty` in the node constructor
(`src/lib/litegraph/src/node/widgetsView.ts`, wired up from
`LGraphNode.ts:1004`), backed by a `shallowReactive` array. The getter returns
`undefined` until the property has been assigned at least once:

```ts
// src/lib/litegraph/src/node/widgetsView.ts
get: () => (state.present ? state.view : undefined)
```

The idiom extensions already use for this still works unmodified:

```ts
this.widgets ||= []
this.widgets.push(widget)
```

`this.widgets ||= []` runs the setter with `[]`, which is enough to flip
`present` to `true`. From then on `node.widgets` returns a stable proxy
(`createArrayMutationView`) over the backing array. Ordinary array reads pass
through; `push`, `splice`, `pop`, `shift`, `unshift`, `sort`, `reverse`,
`copyWithin`, and `fill` are intercepted so that any reordering is written
back to the store via `replaceNodeWidgetOrder` (`src/lib/litegraph/src/node/widgetsView.ts:19-32`).
Index assignment (`node.widgets[2] = w`) and `delete node.widgets[2]` are
intercepted the same way. Nothing here requires extension code to change:
direct mutation of `node.widgets` continues to work and continues to be the
supported pattern (`removeWidget` in `LGraphNode.ts:2252-2272` still does
`this.widgets.splice(widgetIndex, 1)`).

Two things to be aware of:

- Assigning `node.widgets = undefined` clears the array and flips `present`
  back to `false` — a subsequent read returns `undefined` again, not `[]`.
  Guard reads with `node.widgets?.length` rather than assuming an array.
- The order-sync commit needs `node.graph?.rootGraph.id`. If you mutate
  `node.widgets` before the node has been added to a graph, the mutation
  still applies locally but the store isn't told about the new order yet;
  order registration happens for you when the node is attached
  (`attachNodeToStores` in `src/core/graph/nodeShell/nodeShellLifecycle.ts:19-35`).
  You don't need to call anything yourself in the common case of building
  widgets inside a node constructor or `onNodeCreated`.

Despite being an accessor rather than an own data property, `widgets` (like
`inputs` and `outputs`) is re-declared as an enumerable own property in the
constructor specifically so `Object.keys(node)` and `{...node}` still surface
it — this is called out explicitly as a deliberate compatibility guarantee in
the ECS extension-compatibility audit (`docs/architecture/ecs/ecs-extension-compatibility-audit.md:107-114`).
That guarantee does _not_ extend to most other node fields: `id`, `type`,
`title`, `flags`, `mode`, `color`, `bgcolor`, `shape`, and `showAdvanced` lost
their own-enumerable status in the same refactor and no longer appear in
generic enumeration.

## Widget registration is a separate step from construction

Constructing a widget (via `BaseWidget`'s constructor, or `node.addWidget` /
`node.addCustomWidget`) does not, by itself, register it in
`widgetValueStore`. Registration happens through `setNodeId`
(`src/lib/litegraph/src/widgets/BaseWidget.ts:147-161`), which requires the
node to already have a root graph id:

```ts
setNodeId(nodeId: NodeId): void {
  const graphId = this.node.graph?.rootGraph.id
  if (!graphId) return
  const registered = useWidgetValueStore().registerWidget(
    widgetId(graphId, nodeId, this.name),
    { ...this._state, type: this.type, value: this.value },
    deriveWidgetRenderState(this)
  )
  if (registered) this._state = registered
}
```

`addCustomWidget` calls `setNodeId` immediately only if the node already has
a valid id; otherwise registration is deferred until the node is added to a
graph, at which point `attachNodeToStores` walks `node.widgets` and calls
`setNodeId` on every bindable widget. This is transparent for the common case
(building widgets in a constructor before the node is placed on the graph),
but matters if your extension holds a widget reference and reads/writes
`widget.value` before the node is attached: those reads/writes hit a local,
per-instance state object, not the shared store, until attachment happens.
No values are lost in that window — `setNodeId` seeds the store from the
widget's current `value`/`type` — but until then the value won't be visible
to store-driven UI (e.g. the right-side-panel widget list) or other systems
that read `widgetValueStore` directly.

Only widgets that implement `NodeBindable` (i.e. expose `setNodeId`) get
registered at all. `BaseWidget` subclasses do; a plain object literal
returned from a custom widget constructor does not unless it is normalized
into a concrete widget class first. Extend `BaseWidget` (or produce widgets
through the existing `ComfyWidgetConstructor` contract, which is unchanged —
still `{ widget, minWidth?, minHeight? }`) rather than hand-rolling a plain
object if you need store participation.

## Removing widgets

Continue to call `node.removeWidget(widget)` rather than splicing
`node.widgets` and expecting slot/DOM cleanup to happen on its own — it still
clears any input slot's `_widget`/`widget`/`pos` reference to the removed
widget before splicing it out. Removing a widget from `node.widgets` updates
the store's _order_ record for the node automatically (via the mutation-view
commit), but does not by itself delete the widget's _value_ from
`widgetValueStore` — value cleanup on node/widget teardown is handled by the
node-detach path (`detachNodeFromStores` / `releaseNodeWidgets`,
`src/core/graph/nodeShell/nodeShellLifecycle.ts:60-71`) and a few
subgraph-specific call sites (`SubgraphNode.ts:377`,
`promotionUtils.ts:436`, `dynamicWidgets.ts:569`) that call
`widgetValueStore().deleteWidget` explicitly. Removing a node from the graph
keeps its widgets' values in the store by default (so undo can restore them)
and only discards values outright when the whole containing graph is torn
down — you don't need to (and shouldn't) call into `widgetValueStore`
directly to manage this from extension code.

## Don't reach into `widgetValueStore` from extension code

The store is an internal implementation detail behind `node.widgets` and the
`BaseWidget` API, not a documented extension surface — it requires an active
Pinia instance and keys everything by the derived `WidgetId`, both of which
are implementation choices that could still change. Use `node.widgets`,
`node.addWidget`/`addCustomWidget`/`removeWidget`, and `widget.value` as
before; there is no supported reason for extension code to call
`useWidgetValueStore()` directly.

## Widget-level `serializeValue` is unchanged, for now

`widget.serializeValue` and other execution-time widget hooks are called out
in the mutation/compatibility audits (`docs/architecture/ecs/ecs-mutation-audit.md:46`,
`docs/architecture/ecs/ecs-extension-compatibility-audit.md:147-155`) as
retaining their existing (unconstrained, effectful) contract for now, with
further tightening described as future work rather than something already
shipped. If your extension relies on `serializeValue` for side effects during
prompt construction, treat that contract as unchanged today, but expect it to
narrow in a future release; no timeline is documented yet.
