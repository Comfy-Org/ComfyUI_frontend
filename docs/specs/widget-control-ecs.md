# Widget Control ECS

## Objective

Replace `control_after_generate` widgets with plain control state attached to
the widget they control and one graph-level system that advances controlled
values during queueing.

The workflow format and user-visible controls remain compatible. The runtime
model changes from linked widgets with callbacks to a Component and System.

## Model

Each controlled target has one `WidgetControlState` keyed by the target's
canonical `WidgetId`:

```ts
interface WidgetControlState {
  mode: 'fixed' | 'increment' | 'increment-wrap' | 'decrement' | 'randomize'
  filter?: string
  hasExecuted: boolean
}
```

- `filter` exists only for combo controls that expose a filter field.
- `hasExecuted` implements the existing first-run skip in "before" mode.
- The component contains no widget, node, graph, callback, or DOM references.
- The target value and options remain in `widgetValueStore`.
- Popover, focus, and hover state remain local to the view.

The component is registered when the target receives its `WidgetId`, released
with the target, renamed with the target, and cleared with the root graph.
Re-registration preserves the current component state. Replacing the target
with a different widget type removes stale control state.

## System

`runWidgetControl(rootGraph, phase, options)` runs once in each existing queue
phase.

1. Skip partial executions.
2. Skip the phase not selected by `Comfy.WidgetControlMode`.
3. Query controls scoped to the root graph.
4. Derive link-fed target IDs from the live graph and skip them.
5. In "before" mode, mark the component executed and skip its first run.
6. Compute the next value with the existing pure value-control rules.
7. Write through `widgetValueStore`.

There is no general ECS scheduler. The existing queue lifecycle is the system's
explicit scheduling boundary.

## Presentation

The control is not present in `node.widgets` and is not identified through
`linkedWidgets`.

- Classic canvas rendering projects transient mode and filter rows beside the
  target. Projection objects may be cached for stable layout but hold no source
  of truth.
- Vue rendering reads and updates `WidgetControlState` directly by target
  `WidgetId`.
- Control labels continue to reflect the before/after user setting.

## Persistence

Existing workflows retain their positional layout:

- Number: `[targetValue, controlMode]`
- Combo: `[targetValue, controlMode, filter]`

Serialization appends component values after each controlled target.
Configuration consumes valid control slots after registering the target. A
missing or invalid control slot must not consume the next target widget's
value. Control values remain absent from API prompt serialization.

Named widget values continue to describe target widgets only; control
component values remain a compatibility concern of positional
`widgets_values`.

## Promotion and graph scope

A promoted target is controlled at the graph level where its authoritative
value lives. Promotion copies the source control configuration to a component
keyed by the host target's `WidgetId`; host and interior components are
independent after promotion.

The system queries the root graph once and handles regular, nested, and
promoted targets uniformly. It must not traverse into an interior widget at
execution time to mutate a promoted value.

## Compatibility constraints

- Preserve fixed, increment, decrement, randomize, combo wrap, and combo
  filtering behavior.
- Preserve before-mode first-run behavior and after-mode timing.
- Preserve partial-execution and link-fed suppression.
- Preserve positional workflow round trips, including older files with omitted
  control slots.
- Preserve target widget callbacks required by custom widgets when a system
  changes a value.
- Preserve the exported `addValueControlWidget(s)` call signatures and return
  component-backed projections for legacy callers.
- Do not add state or behavior to `LGraphNode`, `LGraphCanvas`, `LGraph`, or
  `Subgraph` beyond narrow projection and lifecycle integration.

## Removal

Once all presentation and persistence paths use the component, remove:

- Real `control_after_generate` and filter widgets from `node.widgets`.
- `IS_CONTROL_WIDGET` and control-widget duck typing.
- Per-control `beforeQueued` and `afterQueued` closures.
- Runtime control identity through `linkedWidgets`.
- The separate promoted-widget control execution path and its `WeakSet`.

## Acceptance criteria

1. A regular number or combo control behaves identically before and after
   workflow save/load.
2. Classic and Vue node renderers edit the same component state.
3. Link-fed and partial-execution targets do not advance.
4. Before mode skips the first execution and advances subsequent executions.
5. Promoted and nested promoted targets advance their authoritative host value
   exactly once.
6. Deleting, replacing, renaming, or clearing a target cannot leave an active
   orphan control.
7. Existing workflow fixtures round-trip without changing positional value
   meaning.
8. No control form widget participates in prompt serialization or
   `node.widgets` iteration.

## Implementation order

1. Component state and lifecycle in the widget value store.
2. Pure value transition and graph-level queue system.
3. Registration, classic projection, and positional persistence.
4. Vue component bridge.
5. Promotion copy and removal of the legacy promoted execution path.
6. Delete obsolete widget markers, callbacks, and compatibility code.
