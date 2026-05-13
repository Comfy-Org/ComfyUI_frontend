# Research: DOM Widget Convergence with Base Widget

Date: 2026-05-12

## Question

Should DOM widgets be unified with base widgets, or kept as a separate concept?

## Current State

### Creation APIs

- `node.addWidget(type, name, value, options)` — creates a standard widget
- `node.addDOMWidget({ name, element, height })` — creates a DOM-backed widget

### Internal Implementation

Both use the same underlying `CreateWidget` command:

```ts
addWidget(type, name, defaultValue, options) {
  return dispatch({ type: 'CreateWidget', widgetType: type, ... })
}

addDOMWidget(opts) {
  return dispatch({ type: 'CreateWidget', widgetType: 'DOM', ... })
}
```

DOM widgets are just widgets with `widgetType: 'DOM'` and an element reference.

### Shared WidgetHandle Interface

Both widget types share the same `WidgetHandle` interface:

| Method                           | Standard Widget | DOM Widget              |
| -------------------------------- | --------------- | ----------------------- |
| `entityId`, `name`, `widgetType` | ✓               | ✓                       |
| `getValue()` / `setValue()`      | ✓ (scalar)      | ✓ (often unused)        |
| `isHidden()` / `setHidden()`     | ✓               | ✓                       |
| `isDisabled()` / `setDisabled()` | ✓               | ✓                       |
| `setHeight(px)`                  | no-op           | ✓ (updates reservation) |
| `on('valueChange')`              | ✓               | ✓                       |
| `getOption()` / `setOption()`    | ✓               | ✓                       |

## Analysis

### Arguments FOR Full Convergence

1. **Single mental model**: Extensions learn one widget concept, not two.
2. **Consistent behavior**: All widgets appear in `node.widgets()`, serialize the same way.
3. **Simpler API surface**: Fewer methods to document and maintain.

### Arguments FOR Keeping Separate APIs

1. **Different ergonomics**: Standard widgets are data-driven (name, value, options); DOM widgets are element-driven (pass an HTMLElement).
2. **Type safety**: `addDOMWidget` can require `element: HTMLElement` at compile time; merging would make it optional with runtime checks.
3. **Clear intent**: Separate APIs signal different use cases.

## Recommendation

**Keep the current partial convergence.** The implementation is unified (`CreateWidget` command), but the creation APIs remain separate for ergonomic reasons.

### Rationale

1. **Creation differs, usage is unified.** Extensions create DOM widgets differently (need an element), but interact with them the same way (via `WidgetHandle`).

2. **Type safety is valuable.** `addDOMWidget({ element })` is clearer than `addWidget('DOM', name, null, { element })`.

3. **Already well-integrated.** DOM widgets appear in `node.widgets()`, get the same events, and use the same serialization infrastructure.

### What "Convergence" Means Here

The widgets are already converged at:

- **Entity level**: Same `WidgetEntityId` brand
- **Interface level**: Same `WidgetHandle` type
- **Command level**: Same `CreateWidget` command internally

The APIs are intentionally separate at:

- **Creation level**: `addWidget` vs `addDOMWidget`

This is the right split — unified where it matters (runtime behavior), separate where it improves DX (creation ergonomics).

## Future Considerations

If we add more widget creation patterns (e.g., `addCanvasWidget`, `addThreeJSWidget`), we might consider:

1. **Factory pattern**: `node.widgets.create('DOM', { element })` / `node.widgets.create('INT', { min, max })`
2. **Builder pattern**: `node.addWidget('DOM').withElement(el).withHeight(200).build()`

For now, two explicit methods (`addWidget`, `addDOMWidget`) serve the common cases well.
