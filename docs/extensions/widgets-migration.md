# Widget System Migration Notes

Widget values now live in a Pinia-backed store instead of directly on the
widget instance. Two hazards follow: widget names must be unique per node,
and renaming a widget after it's added leaves its stored value behind.
`node.widgets` can also be `undefined` until it's first assigned, and only
registered widgets participate in the store.

## Widget names must be unique and stable

Two widgets on the same node cannot share a name. Adding a second widget with
a name that's already in use overwrites the first widget's stored value:

```ts
node.addWidget('number', 'strength', 0, () => {})
node.addWidget('number', 'strength', 1, () => {}) // overwrites the first widget's value
```

Renaming a widget after it's registered has the same effect in reverse: the
store keeps the value filed under the old name, and nothing re-keys it for
you. Don't rename a widget after registration. Remove it and add a new one
with the name you want instead.

## `node.widgets` may be undefined

`node.widgets` returns `undefined` until it's been assigned at least once.
Initialize the array before adding widgets:

```ts
export function nodeCreated(node: LGraphNode) {
  node.widgets ??= []
  node.widgets.push(myWidget)
}
```

Guard reads the same way:

```ts
const widgetCount = node.widgets?.length ?? 0
```

**Setting `node.widgets = undefined` clears it.** A later read returns
`undefined` again, not `[]`.

**Mutations made before the node is attached to a graph are picked up
automatically.** You don't need to call anything yourself for the common
case of building widgets in a constructor or `onNodeCreated`.

`node.widgets` shows up in `Object.keys(node)` and object spreads like
`{...node}`.

## Extend `BaseWidget` instead of returning a plain object

Widgets created through `BaseWidget` (directly, or via `node.addWidget`,
`node.addCustomWidget`, `node.addDOMWidget`) get registered in the store
automatically. A plain object literal is not registered and won't
participate in the store:

```ts
interface MyWidgetState extends IBaseWidget<string, 'custom'> {
  value: string
}

class MyWidget extends BaseWidget<MyWidgetState> {
  override drawWidget(
    ctx: CanvasRenderingContext2D,
    options: DrawWidgetOptions
  ) {
    // draw
  }

  override onClick(options: WidgetEventOptions) {
    // handle click
  }
}

node.addCustomWidget(
  new MyWidget(
    { name: 'my_widget', type: 'custom', value: '', options: {}, y: 0 },
    node
  )
)
```

```ts
// Not registered: the store never sees this widget
node.widgets.push({ name: 'my_widget', type: 'custom', value: '' })
```

If you read or write `widget.value` before the node is attached to a graph,
the value is held locally and synced to the store on attachment. No values
are lost, but store-driven UI (such as the right-side panel) won't see the
value until then.

## Remove widgets with `node.removeWidget()`

Use `node.removeWidget(widget)` to remove a widget. Splicing `node.widgets`
directly skips slot cleanup, and the removed widget's value stays in the
store until the node itself is removed from the graph.

## Don't call `useWidgetValueStore()` from extension code

Do not call `useWidgetValueStore()` from extensions. Use `node.widgets`,
`node.addWidget()` / `addCustomWidget()` / `removeWidget()`, and
`widget.value` instead. The store's internal keying and its dependency on
Pinia are not a supported extension surface.
