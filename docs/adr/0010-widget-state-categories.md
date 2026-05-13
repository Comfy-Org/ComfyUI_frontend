# 10. Widget State Categories

Date: 2026-05-12

## Status

Proposed

## Context

The current widget system evolved organically and has several architectural issues:

- `options` is a constructor bag that gets reference-assigned, not copied
- Instance properties (`widget.hidden`) and options bag (`widget.options.hidden`) are used interchangeably for the same concept
- No clear separation between schema (type/name), runtime state (value/disabled), display hints (hidden), per-instance config (min/max), and serialization config
- `Object.assign(this, safeValues)` in BaseWidget constructor means arbitrary properties can land on the instance
- The dual `hidden` location causes bugs: Vue renderer reads `options.hidden`, canvas renderer reads `widget.hidden`

The ECS implementation uses 5 separate components (`WidgetComponentValue`, `WidgetComponentDisplay`, `WidgetComponentSchema`, `WidgetComponentSerialize`, `WidgetComponentContainer`), but this granularity is an implementation detail that shouldn't leak into the extension API.

### Forces

- Extensions need a simple, predictable mental model for widget state
- The API should align with familiar patterns (Vue's component model)
- ECS internals should remain hidden behind a facade
- Migration from v1 patterns should be straightforward
- The distinction between "presence of a constraint" (schema) and "value of a constraint" (prop) matters for primitives and subgraph widget merging

## Decision

Widget state is organized into **two categories**:

### Schema (Immutable)

Properties that cannot change after widget construction:

- `type` — widget type string (e.g., `'INT'`, `'STRING'`, `'COMBO'`)
- `name` — widget name as declared in `INPUT_TYPES`
- Presence of constraints (the *fact* that min/max/step exist)
- Default values

Schema comes from the node definition and is frozen at construction time.

### Props (Mutable, Per-Instance)

Everything else — all per-instance state that can change at runtime:

- `value` — the primary data (like Vue's `modelValue`)
- `disabled`, `hidden`, `label`, `advanced`
- Actual values of `min`, `max`, `step` (presence is schema, values are props)
- `serialize` flag
- `callback`, `draw`, `mouse`, `computeSize` (functions are values in JS)

Props follow one-way data flow: systems mutate props, views observe them.

### Model Value Convention

`value` is special only by convention, not by nature:

- It serializes to workflow JSON (`widgets_values`)
- It goes to the backend in prompts
- It gets an ergonomic `.value` accessor (like Vue's `defineModel()`)

This mirrors Vue's `modelValue` — the prop that `v-model` binds to.

### API Surface

```typescript
interface WidgetHandle<T> {
  // Schema (readonly)
  readonly name: string
  readonly widgetType: string

  // Props: value (modelValue) — ergonomic accessor
  value: T
  getValue(): T      // alias
  setValue(v: T): void  // alias

  // Props: common — ergonomic accessors
  isHidden(): boolean
  setHidden(hidden: boolean): void
  isDisabled(): boolean
  setDisabled(disabled: boolean): void

  // Props: type-specific — via getOption/setOption
  getOption<K>(key: string): K | undefined
  setOption(key: string, value: unknown): void
}
```

### ECS Mapping

The `WidgetHandle` facade maps to ECS components:

| WidgetHandle | ECS Component |
|--------------|---------------|
| `name`, `widgetType` | `WidgetComponentSchema` |
| `value` | `WidgetComponentValue` |
| `hidden`, `disabled`, `label` | `WidgetComponentDisplay` |
| `serialize` | `WidgetComponentSerialize` |
| type-specific options | `WidgetComponentSchema.options` |

The 5-component split is an implementation detail. Extensions see only Schema + Props.

## Consequences

### Positive

- Simple mental model: just two categories (Schema + Props)
- Aligns with Vue's component model (props, modelValue, one-way data flow)
- Clear rule: "presence is schema, values are props"
- ECS internals hidden behind facade
- `.value` accessor provides ergonomic access to the primary data
- Functions treated as values (JS-native thinking)

### Negative

- Existing code uses mixed patterns (`widget.hidden` vs `widget.options.hidden`) — migration needed
- The "presence vs value" distinction may be confusing initially
- `getOption`/`setOption` is less ergonomic than direct property access for common props

### Migration

For extensions currently using `widget.options.hidden = true`:

1. Phase A: Shim translates to internal mutation
2. Phase B: `setHidden()` dispatches ECS command (enables undo/redo)
3. Deprecation warnings guide to `widget.setHidden(true)` or `widget.setProp('hidden', true)`

## Notes

### Slack Discussion (2026-05-12)

Key insights from `#frontend-eng`:

- Austin: "Using min as an example. Under what circumstances would it change, or need to be externally observable?"
- Alex: "A lot of bugs come from 'changing the graph topology mutates values'"
- Christian: "The presence of min and max are immutable in the schema. Along with defaults. Their values would be props, which are only set by the systems"
- Christian: "Views of the data shouldn't directly mutate the props just like with Vue"

### Related Decisions

- D7: Widget shape and persistence model (superseded by this ADR for categorization)
- D13: ECS alignment audit (identified the dual `hidden` bug)
- D14: Decision log entry for this ADR

### Open Questions

1. How does this interact with Node Definition V3's `V3.CustomWidget`?
2. Schema merging for subgraph widgets with mixed constraints
3. Should connecting a second widget to a subgraph widget reset to default?
