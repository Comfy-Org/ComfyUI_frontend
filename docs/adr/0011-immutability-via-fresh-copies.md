# 11. Immutability Enforcement via Fresh Copies

Date: 2026-05-12

## Status

Accepted

## Context

The extension API exposes collection-returning methods like `widgets()`, `inputs()`, `outputs()`, and object-returning methods like `getProperties()`. These methods need immutability guarantees to prevent extensions from accidentally or intentionally mutating internal state.

### The Problem

Without runtime immutability enforcement:

- Extensions could push items into `widgets()` array, corrupting internal state
- Mutations to returned objects would silently affect internal data
- Debugging would be difficult — state corruption could surface far from the mutation site
- Internal framework code might inadvertently rely on returned arrays being stable

TypeScript's `readonly` modifier and JSDoc annotations provide compile-time protection, but:

- JavaScript consumers have no protection
- Type assertions can bypass readonly
- Agent-generated code may not respect type hints

### Options Considered

| Option                   | Pros                                                      | Cons                                                     |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| **1. `Object.freeze()`** | Runtime immutability, throws on mutation                  | Performance overhead, nested objects need deep freeze    |
| **2. Return fresh copy** | Simple, functional style, no mutation affects source      | Slight memory overhead, multiple calls = multiple arrays |
| **3. Proxy wrapper**     | Helpful error messages, can intercept specific operations | Complexity, performance overhead, harder to debug        |
| **4. TypeScript only**   | Zero runtime cost                                         | No protection for JS consumers, can be bypassed          |
| **5. Private fields**    | True encapsulation                                        | Blocks read access too, not suitable for APIs            |

## Decision

**Return fresh copies** (Option 2) for all collection-returning and object-returning methods in the extension API.

### Implementation Pattern

```ts
// CORRECT: Return fresh copy
widgets(): readonly WidgetHandle[] {
  const container = world.getComponent(nodeId, WidgetComponentContainer)
  return (container?.widgetIds ?? []).map(createWidgetHandle)
  // Each call creates new array — mutations don't affect internal state
}

getProperties(): Record<string, unknown> {
  return { ...world.getComponent(nodeId, NodeTypeKey)?.properties }
  // Shallow copy — mutations don't affect source
}
```

### Scope

Apply this pattern to:

- `NodeHandle.widgets()` — returns fresh `WidgetHandle[]`
- `NodeHandle.inputs()` — returns fresh `SlotInfo[]`
- `NodeHandle.outputs()` — returns fresh `SlotInfo[]`
- `NodeHandle.getProperties()` — returns fresh `Record<string, unknown>`
- `WidgetHandle` methods that return objects (if any)
- Any future collection/object-returning methods

### Internal Callers

Framework-internal code must also use mutation APIs rather than mutating returned collections:

```ts
// WRONG: Mutating returned array
const widgets = node.widgets()
widgets.push(newWidget) // No effect on node!

// CORRECT: Use mutation API
node.addWidget(type, name, value, options)
```

## Consequences

### Positive

- **True immutability**: Mutations to returned data never affect internal state
- **Predictable behavior**: Each call returns fresh data reflecting current state
- **Simple mental model**: "This is your copy, do what you want with it"
- **JavaScript-safe**: Works regardless of TypeScript types

### Negative

- **Memory overhead**: Multiple calls create multiple arrays (usually negligible)
- **No mutation detection**: Extensions silently get isolated copies, won't know their mutations are ignored
- **Fresh reference each call**: Cannot use `===` to detect changes (use deep comparison or events)

### Mitigations

- Document that returned collections are snapshots
- Use events (`valueChange`, `propertyChange`) to observe changes
- The memory overhead is negligible for typical widget/slot counts

## Notes

This decision was made during design review of PR #12142 (ext-api foundation). See `design-review-12142.md` Topic 14 for the full discussion thread.

The alternative of `Object.freeze()` was rejected because:

- It requires deep freezing for nested objects
- Performance overhead for each call
- Fresh copies achieve the same goal more simply
