# Widget Value Recipe Book

This is a **starting point, not an exhaustive reference**. It maps common
use-cases to idiomatic patterns for reading/writing widget component values on
nodes, grounded in the migration in
[PR #15879](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15879). Add a
recipe here when you hit a case that isn't covered yet.

## Context

Historically, node UIs that needed to react to a widget's value (Load3D,
painter, bounding-box editors, camera info, mask editor, compositor) did so by
monkey-patching `widget.callback`, mutating `widget.value` directly, or
manually re-syncing `node.widgets_values`. #15879 replaces those patterns:
`BaseWidget.value` is now backed by `widgetValueStore` (a `WidgetId`-keyed
Pinia store, `WidgetId = graphId:nodeId:name`), so widget state is reactive
Vue state you can read with `computed`, react to with `watch`, and mutate
through explicit setters.

The question this doc answers: **given a widget value you need to read,
derive from, or react to, which reactive tool should you reach for?**

## Default pattern: component-scoped `watch`/`computed`

If the code that needs the widget value lives inside a Vue component's
`setup()`, just use `computed`/`watch` there. Vue disposes the effect
automatically on unmount — no manual bookkeeping needed.

`useCameraInfo.ts` is the clearest example. The old code wrapped every
relevant widget's `callback` to re-derive camera state by hand. The new
version derives it as a `computed`, and uses exactly one `watch` for the one
genuinely imperative step (pushing state into the Three.js-backed viewport):

```ts
const cameraState = computed(() => readCameraInfoState(toRaw(node.value)))
const mode = computed(() => cameraState.value.mode)

watch(cameraState, (state) => {
  if (!viewport || isEqual(state, viewport.overlay.getState())) return
  viewport.applyState(state)
})
```

Painter and the bounding-box editor (`useBoundingBoxes.ts`) follow the same
shape: widget-backed dimensions become `computed` values consumed by layout
code, rather than copied into local refs that then need to be kept in sync.

## Rule of thumb: usually you don't want a watcher

A `watch` is for **synchronizing an external system** — a Three.js scene, a
canvas, a viewport overlay, an emitted event. If you're just deriving one
value from another, that's a `computed` (or a writable `computed` if the UI
also needs to write it back), not a watcher.

Before reaching for `watch`, ask: *is this a value, or is this a side
effect?* A widget-store-backed `computed` re-evaluates automatically whenever
its dependencies change — no explicit synchronization code, and nothing to
dispose. Reach for a `watch` only for the leftover imperative step (calling
into Three.js, a canvas 2D context, a legacy callback) that a computed value
alone can't perform.

## Node-lifetime registry pattern

Component-scoped `watch`/`computed` isn't available everywhere. #15879
introduces `src/composables/node/widgetStoreSync.ts` for the cases that
can't rely on a Vue component's lifecycle:

```ts
export type WidgetNode = LGraphNode | null

export function nodeWidgetValue(node: WidgetNode, name: string): unknown { ... }

export function setNodeWidgetValue(
  node: WidgetNode,
  name: string,
  value: WidgetValue
): boolean { ... }

export function watchNodeWidgetValues(
  node: LGraphNode,
  key: string,
  names: readonly string[],
  onChange: (values: unknown[]) => void
): void {
  if (!node.graph) {
    // A watch created before the node's widgets register with the store
    // would collect zero reactive dependencies and never fire. Defer.
    node.onAdded = useChainCallback(node.onAdded, () => {
      watchNodeWidgetValues(node, key, names, onChange)
    })
    return
  }
  ensureRemovalListener(node)
  let syncs = nodeSyncs.get(node)
  if (!syncs) {
    syncs = new Map()
    nodeSyncs.set(node, syncs)
  }
  syncs.get(key)?.() // re-registering the same key replaces the watcher
  syncs.set(key, watch(/* ... */))
}
```

**Why this exists instead of a component watch**, per the actual use-cases in
#15879:

- **The bounding-box/imagecrop sub-widgets are `canvasOnly`.** In legacy
  canvas rendering mode there is no mounted Vue component to hang a `watch`
  off of — the widget is drawn directly on the LiteGraph canvas.
- **Components unmount while the node lives on.** Collapsing a node,
  switching render modes, and (in the future) node virtualization all
  unmount a node's Vue component tree without removing the node itself.
  Widget values can keep changing while no component exists to own a watch.
- **Drivers outside the component tree fire the mutations.** `onExecuted`
  and `configure()` (workflow load) write widget values from outside any
  component's `setup()`, so nothing there would trigger a component-local
  watcher anyway — the watch has to be owned by something with node-length
  lifetime.

Key mechanics worth knowing before you use it:

- Keys are per `(node, key)` — re-registering the same key on the same node
  **replaces** the previous watcher, because re-entrant `configure()` calls
  happen and would otherwise stack duplicate watches.
- Wiring is deferred via `node.onAdded` when the node has no `graph` yet — a
  watch created before widgets are registered in the store collects no
  reactive dependencies and never fires.
- All of a node's watchers are disposed together on the graph's typed
  `node:before-removed` event, which fires on removal, clear, and subgraph
  release.

> **Known limitation** (flagged in [review #5015190322](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15879#pullrequestreview-5015190322)):
> re-arming after removal only happens via the `onAdded`-deferred path, so a
> node that was normally attached when first registered does not currently
> resubscribe after a remove/re-add (e.g. delete + undo). Know this if you're
> relying on the registry across a node's full lifetime including removal and
> restoration.

## `effectScope()` for scoped-but-non-component reactivity

Sometimes you need scoped disposal — grouped `watch`/`computed` effects that
get torn down together — but the natural owner isn't a node's full lifetime
and there's no Vue component to attach to. That's what Vue's
[`effectScope()`](https://vuejs.org/api/reactivity-advanced.html#effectscope)
is for: it lets you create and stop a group of effects manually, independent
of any component.

Reach for `effectScope()` over the node-lifetime registry when the reactivity
needs a scope shorter than or unrelated to node removal — e.g. effects tied
to a modal being open, an editor session, or a feature instance that gets
created and torn down more often than the node itself. Reach for the
`widgetStoreSync` registry when the effect genuinely needs to survive
component unmount/remount for as long as the node exists on the graph.

## Worked example: Load3D target-size sync

`Load3DConfiguration.ts` previously overwrote `width`/`height` widget
callbacks directly:

```ts
// before
width.callback = (value: number) => {
  this.load3d.setTargetSize(value, height.value as number)
  onSceneInvalidated?.()
}
height.callback = (value: number) => {
  this.load3d.setTargetSize(width.value as number, value)
  onSceneInvalidated?.()
}
```

With #15879, both widgets are read via one node-lifetime watch, and the
initial value is applied immediately (a `watch` only fires on subsequent
changes):

```ts
export function wireTargetSizeSync(
  node: LGraphNode,
  resolveLoad3d: () => Load3d,
  onSceneInvalidated?: () => void
): void {
  watchNodeWidgetValues(
    node,
    'load3d:target-size',
    ['width', 'height'],
    ([w, h]) => {
      if (typeof w !== 'number' || typeof h !== 'number') return
      resolveLoad3d().setTargetSize(w, h)
      onSceneInvalidated?.()
    }
  )
}

// setupTargetSize:
this.load3d.setTargetSize(width.value as number, height.value as number)
wireTargetSizeSync(node, () => this.load3d, onSceneInvalidated)
```

The `model_file` widget follows the same shape, replacing an
`Object.defineProperty` hijack of `modelWidget.value` plus a wrapped
`callback` with one `watchNodeWidgetValues` call keyed `'load3d:model-file'`.

## Worked example: bounding-box/imagecrop composite widget

`useBoundingBoxWidget.ts` links one `Bounds` object widget to four numeric
sub-widgets (`x`, `y`, `width`, `height`), all `canvasOnly`. Two node-lifetime
watches replace the old callback-based field mutation:

```ts
watchNodeWidgetValues(node, `bounds:${name}:main`, [name], ([bounds]) => {
  if (isBounds(bounds)) syncSubWidgets(bounds)
})

watchNodeWidgetValues(
  node,
  `bounds:${name}:fields`,
  subWidgetNames,
  (values) => {
    const bounds = nodeWidgetValue(node, name)
    if (!isBounds(bounds)) return
    if (values.some((v) => typeof v !== 'number')) return
    const next: Bounds = {
      x: Math.round(values[0] as number),
      y: Math.round(values[1] as number),
      width: Math.round(values[2] as number),
      height: Math.round(values[3] as number)
    }
    if (FIELDS.every((field) => next[field] === bounds[field])) {
      syncSubWidgets(next) // fractional edit rounded to the same value: snap back
      return
    }
    setNodeWidgetValue(node, name, next) // rounded whole-object write
  }
)
```

Sub-widgets are registered under namespaced names (`bounds.x`, with a bare
`label` for display) so they can't collide with same-named node widgets in
the store. Note [review #5015271486](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15879#pullrequestreview-5015271486)'s
suggestion for where this could still simplify further: model `Bounds` as the
single authoritative value and make the four fields writable projections over
it, rather than two watches reconciling five independently-stored values.

## Adding to this book

This is deliberately thin today. As the team hits new widget-value use-cases
during the `widgetValueStore` migration (or afterward), add a recipe here —
use-case, why the default pattern didn't fit, and the pattern that did. The
goal is a shared reference the whole team can point custom-node-facing and
core-node work at, per the discussion on #15879.
