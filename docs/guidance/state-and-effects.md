---
globs:
  - 'src/**/*.ts'
  - 'src/**/*.vue'
---

# State, Effects and Workflows

How to represent a multi-step process — onboarding, a wizard, an upload, a
checkout, anything with a beginning and an end — in a reactive framework.

> **Events initiate work. One explicit state represents the workflow. Pure
> derivations shape the UI. Effects only synchronise with external systems.**

This applies to any framework; the Vue mapping is at the bottom.

## 1. One state, not several booleans

Hold the **minimum authoritative facts** needed to render and continue. Anything
computable from them is not state.

Avoid independent booleans for what is really one value. Prefer a discriminated
union, so invalid combinations are structurally impossible rather than merely
unlikely.

```ts
// ✗ four facts that must agree, and nothing makes them
const steps = ref<Step[]>([])
const stepIdx = ref(-1)
const waiting = ref(false)
const active = ref<Flow | null>(null)

// ✓ one fact
type FlowState =
  | { phase: 'idle' }
  | { phase: 'awaiting'; flow: Flow; steps: Step[]; idx: number }
  | { phase: 'showing'; flow: Flow; steps: Step[]; idx: number }
  | { phase: 'finished'; flow: Flow; outcome: Outcome }
```

**The tell:** if ending the workflow means resetting four variables in the right
order, it was one state and you gave it four variables.

## 2. Change state through named events and a pure transition

```ts
type FlowEvent =
  | { type: 'started'; flow: Flow; steps: Step[] }
  | { type: 'advanced' }
  | { type: 'skipped' }

function reduceFlow(state: FlowState, event: FlowEvent): FlowState // pure switch
```

Invalid transitions become harmless — an event that means nothing in the current
phase returns the state untouched — and valid ones become reviewable in one
place. This is the same reason most frameworks recommend a reducer once
state-update logic gets complex.

It is also exhaustively testable: every state crossed with every event, including
the pairs that should do nothing.

## 3. Async orchestration belongs in commands

Do **not** build chains where each step is an effect reacting to the last:

```
saving changed → effect saves → saved changed → effect invalidates
              → invalidated changed → effect navigates
```

Nobody can read that as one sequence, and the middle of it is reachable from
places you did not intend. Give the whole causal sequence to one function:

```ts
async function startFlow(id: string) {
  const data = await load(id)
  if (!data) return false
  dispatch({ type: 'started', flow: id, steps: build(data) })
  await settle()
  dispatch({ type: 'stepEntered', idx: 0 })
  return true
}
```

## 4. Derive everything derivable

Do not store `isOpening`, `canTransition`, `isLast`, or a second copy of data
that already exists. If a `computed` can name it, do not put it in a `ref` and
keep it in sync by hand — the sync is where the bugs live.

## 5. Reserve effects for synchronising with the outside

**Good effects** — one-way, outward, and they write nothing anything else reads:

- state changed → emit telemetry
- state changed → write a setting
- component disposed → abort a request or unsubscribe
- external socket event → _dispatch an event_ (not: assign state directly)

**Bad effects:**

- pointer target changed → recalculate steps
- success changed → advance the workflow
- an effect that writes state a second effect reads

### Keep rendering out of implicit dependency collection

Never call canvas `draw()` or `setDirty()` from `watchEffect`. Rendering reads
large amounts of state; if any of it becomes reactive, Vue records those reads
as dependencies and later rendering writes can create a redraw feedback loop.
Use `watch` with an explicit source list when an effect must invalidate or draw
the canvas:

```ts
watch(
  [() => settings.linkMode, () => canvasStore.canvas],
  ([linkMode, canvas]) => {
    if (!canvas) return
    canvas.links_render_mode = linkMode
    canvas.setDirty(false, true)
  },
  { immediate: true }
)
```

The same principle applies to whole-graph walks and DOM measurement: make their
triggers explicit so incidental reads cannot silently widen when internals are
made reactive.

If two effects communicate through shared state, that is a transition wearing a
disguise. Put it in the reducer.

## 6. Do not inspect the DOM for something a store already knows

Avoid `getBoundingClientRect`, `getComputedStyle`, and `document.querySelector`
for positions and sizes that a store holds — especially inside a `computed`,
where every recompute becomes a layout read.

For canvas-anchored UI: `layoutStore` holds node bounds and `useTransformState`
mirrors the camera, both reactive, so a screen rect is a **derivation** rather
than a measurement. Floating UI accepts a
[virtual element](https://floating-ui.com/docs/virtual-elements) for exactly
this.

Two caveats worth knowing rather than discovering:

- `layoutStore` bounds are the node's **body box**. The element renders one
  `NODE_TITLE_HEIGHT` above `position` and the resize tracker subtracts it, so
  anything deriving a rect must add it back — and a collapsed node is exactly one
  title tall, which is zero without it.
- Node ids are **graph-local**. An id resolved against one graph names a
  different node in another, so anything holding one across a workflow or
  subgraph change must pin the graph it resolved against.

## 7. Reach for a formal state machine when it earns it

Parallel regions, nested states, timed transitions, cancellation, replay — at
that point a library (XState or equivalent) buys real guarantees.

Below it, a discriminated union plus a pure reducer is the same model without the
dependency, and the migration between them is mechanical. **There is currently no
XState in this repo**; introducing it is a deliberate decision, not a default.

Note that two genuinely parallel regions — say a wizard's progress and a
long-running job's outcome — should be two small states, not one product type.

## Vue mapping

| Concern               | Where it goes                                 |
| --------------------- | --------------------------------------------- |
| Workflow state        | `ref` / `shallowRef` in a Pinia store         |
| Transition            | pure function, its own module, no Vue imports |
| Derived UI            | `computed`                                    |
| External sync         | `watch` / `watchEffect`                       |
| The workflow itself   | store method (a command)                      |
| Complex state machine | XState or equivalent                          |

**Mental model:** user or external event → command performs async work → typed
event → pure state transition → reactive derived UI. Effects sit _beside_ this
loop, only to synchronise with external systems.
