# Widget Value Recipe Book

## The menu

| What are you making                                                                            | Technique                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| A value derived from other reactive state                                                      | `computed`                            |
| A field that reads one value and writes back through it                                        | Writable `computed`                   |
| Keeping an external system (a Three.js scene, a canvas, an imperative widget callback) in sync | A feature-owned `watch`               |
| A one-time load, save, or reset                                                                | A direct, command-style function call |
| Several effects with no component to own them, sharing one lifetime                            | `effectScope()`                       |

Pick the row that matches the problem, then follow its recipe below.

## `computed`: the stock

Every dish starts here. If a value can be produced from other reactive
state, produce it with `computed` and stop there.

**When to use it.** The value is fully determined by other reactive state,
and nothing needs to be told about the change beyond whoever reads the
computed value.

**Ingredients.** The reactive state it depends on (refs, other computeds,
store state), and a pure derivation function with no side effects.

**Method.**

```ts
const width = ref(0)
const height = ref(0)

const area = computed(() => width.value * height.value)
```

Nothing else to wire up. Reading `area.value` anywhere pulls the current
derived value.

**How to know it worked.** `area.value` updates the instant `width` or
`height` changes, with no explicit call to refresh it. There's no separate
write path to keep in sync, and nothing to dispose: a `computed` with no
active subscriber is simply inert.

**Common ways to get it wrong.**

- Introducing a `ref` plus a `watch` to keep it "in sync" with its inputs.
  That's a duplicate source of truth with a lag built in.
- Putting side effects inside the getter, such as network calls or mutating
  other state. A `computed` getter must stay pure, since Vue can call it any
  number of times.

## Writable `computed`: the two-way projection

**When to use it.** A UI surface needs to both read and write a field that's
really a view onto a larger value, for example one coordinate of a bounding
box.

**Ingredients.** The single object that owns the real data (a `ref` holding
a composite value), and a `get`/`set` pair on the `computed`.

**Method.**

```ts
const bounds = ref({ x: 0, y: 0, width: 0, height: 0 })

const x = computed({
  get: () => bounds.value.x,
  set: (value) => (bounds.value = { ...bounds.value, x: value })
})
```

`x.value = 10` writes through to `bounds`, and any other view derived from
`bounds` picks up the change.

**How to know it worked.** Writing through the projection updates the source
object, and every other computed derived from that same source reflects the
write immediately, since they all read from one place.

**Common ways to get it wrong.**

- Giving the projection its own private `ref` instead of writing through to
  the source. Now there are two copies of the same value, and they drift as
  soon as one changes without the other.
- Mutating the source object directly in the setter instead of assigning a
  new one. It can still work with Vue's reactivity, but it makes the update
  harder to trace and easy to get wrong once the object is shared.

## `watch`: the seasoning

Watchers finish a dish; they don't build the base of it. Reach for `watch`
only when something outside Vue's reactivity graph needs to be told about a
change.

**When to use it.** The change needs to be pushed into a system Vue doesn't
own: a Three.js scene, a canvas 2D context, an imperative widget callback,
an emitted event.

**Ingredients.** A `computed` (or ref) representing the value that changed,
a handle to the external system being synchronized, and something that owns
the watch's lifetime (a component's `setup()`, or an `effectScope()`).

**Method.**

```ts
const cameraState = computed(() => readCameraState(node))

watch(cameraState, (state) => {
  if (isEqual(state, viewport.overlay.getState())) return
  viewport.applyState(state)
})
```

The `computed` does the deriving. The `watch` does the one genuinely
imperative step: pushing state into a system Vue doesn't track.

**How to know it worked.** The external system's state matches
`cameraState.value` after every change, and the watch callback runs exactly
once per actual change, not once per re-render.

**Common ways to get it wrong.**

- Using `watch` to derive a value that a `computed` could produce directly.
  If nothing external is being told about the change, there's no reason for
  a watcher.
- Skipping the equality guard, so every reactive tick reapplies state to the
  external system even when nothing meaningfully changed.
- Losing track of who disposes it. A component unmount stops one created in
  `setup()` automatically, but a `watch` created inside an `effectScope()`
  needs that scope's `stop()` called deliberately, or it keeps running on a
  stale subscription.

## Command-style calls: quick, deliberate actions

**When to use it.** A single imperative action happens once, in response to
one event, such as a button press. There's no ongoing value to keep in
sync.

**Method.**

```ts
function onSubmit() {
  saveWidgetValue(node, name, draft.value)
}
```

**Common ways to get it wrong.** Wrapping the action in a `ref` plus a
`watch`, setting a flag and watching the flag, to trigger it. A watcher
implies "keep doing this as things change." If the action only happens once,
in response to one explicit event, just call the function.

## `effectScope()`: the shared pan

**When to use it.** Several `watch`/`computed` effects need one shared
lifetime, but there's no component to own them, or the effects need to
outlive the component that created them.

**Ingredients.** Vue's
[`effectScope()`](https://vuejs.org/api/reactivity-advanced.html#effectscope),
and something concrete that marks the end of the owning lifetime, such as a
node removed from the graph, a session ending, or a feature instance being
torn down.

**Method.**

```ts
const scope = effectScope()

scope.run(() => {
  const derived = computed(() => deriveValue(source.value))
  watch(derived, syncToExternalSystem)
})

// when the owning lifetime ends:
scope.stop()
```

**How to know it worked.** Every effect created inside `scope.run()` stops
firing the instant `scope.stop()` runs, in one call, regardless of how many
`watch`/`computed` pairs were grouped inside it.

**Common ways to get it wrong.**

- Never calling `scope.stop()`. The effects keep running, and keep their
  dependencies alive, after whatever they were serving is gone: an orphaned
  effect that leaks memory and keeps doing pointless work.
- Tying `scope.stop()` to a component unmount when the whole reason for the
  scope was that no component owns this lifetime. Tie it to the actual
  owning event instead.

## One source of truth: mise en place

**When to use it.** Several UI surfaces need the same data, and the
temptation is to keep a separate ref per surface, synchronized by watchers.

**Ingredients.** One canonical `ref` (or store entry) holding the real
value, and a `computed` projection for every other surface that needs a
view onto it.

**Method.**

```ts
// One source
const bounds = ref({ x: 0, y: 0, width: 0, height: 0 })

// Views, not copies
const x = computed({
  get: () => bounds.value.x,
  set: (value) => (bounds.value = { ...bounds.value, x: value })
})
const area = computed(() => bounds.value.width * bounds.value.height)
```

Not this:

```ts
const x = ref(0)
const y = ref(0)
const width = ref(0)
const height = ref(0)
watch([x, y, width, height], () => {
  /* reconcile into a Bounds object, and the reverse */
})
```

**How to know it worked.** There's exactly one place a write can originate,
and every other view is a `computed` reading from it. No watchers
reconciling copies in opposite directions.

**Common ways to get it wrong.**

- Two watchers keeping several fields and one composite value in sync in
  both directions. That reconciliation code is the tell that the composite
  value should be the source of truth, with the fields modeled as writable
  projections over it.
- Letting a second copy creep in "just for this one screen." Every extra
  copy is another place a write can be missed.

## Service note

Reach for `computed` first. Add a `watch` only for the step that touches
something outside Vue. Give a one-time action a direct command-style call.
Group effects that have no component to own them in an `effectScope()` with
a real owner. Model one authoritative value and project the rest.
