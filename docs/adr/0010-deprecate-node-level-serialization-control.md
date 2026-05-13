# 10. Deprecate Node-Level Serialization Control

Date: 2026-05-12

## Status

Accepted

## Context

The v2 extension API initially included `node.on('beforeSerialize', handler)` as a migration path from v1 patterns like `node.onSerialize` and `nodeType.prototype.serialize` patching. This allowed extensions to:

1. **Append extra fields** to the serialized node object
2. **Transform the entire serialized object** via a replace function

However, during design review (PR #12142), we questioned whether node-level serialization control is the right abstraction:

### The Problem

Node-level serialization control is fundamentally **wrong-layered**:

- **Extension state should live in widgets**, not as arbitrary fields on the node
- Widget-level `beforeSerialize` already handles all legitimate use cases
- Node-level hooks encourage storing extension state in ad-hoc `node.properties` or custom fields, which:
  - Breaks the clean separation between framework concerns and extension concerns
  - Creates hidden dependencies between serialization format and extension behavior
  - Makes migration and format evolution harder

### v1 Usage Analysis

Touch-point audit of `nodeType.prototype.serialize` and `node.onSerialize` patterns in the wild:

| Use Case                    | Proper v2 Alternative                               |
| --------------------------- | --------------------------------------------------- |
| Store extension state       | Use widget values with `beforeSerialize`            |
| Persist per-instance config | Use `widget.setOption()` → `widget_options` sidecar |
| Add metadata for export     | Use a dedicated extension state widget              |
| Transform output format     | Framework concern, not extension concern            |

No use case requires node-level control that can't be better served by widget-level APIs.

## Decision

**Deprecate `node.on('beforeSerialize')`** — mark as `@deprecated` with clear guidance pointing to widget-level alternatives. Remove in v1.0.

Widget-level serialization control (`widget.on('beforeSerialize')`) remains fully supported as the correct abstraction.

### Migration Path

Extensions currently using `node.on('beforeSerialize')` should:

1. **Store state in widgets** instead of arbitrary node fields
2. **Use `widget.on('beforeSerialize')`** to control serialization per-widget
3. **Use `widget.setOption()`** for per-instance configuration

Example migration:

```ts
// BEFORE (v1 / deprecated v2)
node.on('beforeSerialize', (e) => {
  e.data['my_extension_state'] = computeState()
})

// AFTER (recommended v2)
const stateWidget = node.addWidget('STRING', '_my_state', '', {
  hidden: true,
  serialize: true
})
stateWidget.on('beforeSerialize', (e) => {
  e.setSerializedValue(JSON.stringify(computeState()))
})
```

### Implementation Steps

1. Add `@deprecated` tag to `node.on('beforeSerialize')` with migration guidance
2. Add console.warn when the deprecated event is used (dev mode only)
3. Update documentation to recommend widget-level patterns
4. Remove `NodeBeforeSerializeEvent` type and handler in v1.0

## Consequences

### Positive

- **Cleaner architecture**: Extension state flows through widgets, the designed data channel
- **Better debuggability**: Widget values are visible in workflow JSON at predictable locations
- **Easier migration**: Future format changes only need to consider widget serialization
- **Reduced API surface**: One less event type to maintain and document

### Negative

- **Migration burden**: Extensions using node-level serialization must refactor
- **Potential edge cases**: Some exotic use cases may require workarounds

### Risk Mitigation

- Deprecation warning gives extension authors runway to migrate
- Widget-level APIs are already more capable than node-level alternatives
- The `@deprecated` tag and docs provide clear migration path

## Notes

This decision was made during design review of PR #12142 (ext-api foundation). See `design-review-12142.md` Topic 11 for the full discussion thread.

Related decisions:

- Widget-level `beforeSerialize` remains the primary extension serialization hook
- `setSerializeEnabled()` remains for simple static opt-out cases
