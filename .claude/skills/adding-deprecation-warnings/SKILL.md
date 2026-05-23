---
name: adding-deprecation-warnings
description: 'Adds deprecation warnings for renamed or removed properties/APIs. Searches custom node ecosystem for usage, applies defineDeprecatedProperty helper, adds JSDoc. Triggers on: deprecate, deprecation warning, rename property, backward compatibility.'
---

# Adding Deprecation Warnings

Adds backward-compatible deprecation warnings for renamed or removed
properties using the `defineDeprecatedProperty` helper in
`src/lib/litegraph/src/utils/feedback.ts`.

## When to Use

- A property or API has been renamed and custom nodes still use the old name
- A property is being removed but needs a grace period
- Backward compatibility must be preserved while nudging adoption

## Steps

### 1. Search the Custom Node Ecosystem

Before implementing, assess impact by searching for usage of the
deprecated property across ComfyUI custom nodes:

```text
Use the comfy_codesearch tool to search for the old property name.
Search for both `widget.oldProp` and just `oldProp` to catch all patterns.
```

Document the usage patterns found (property access, truthiness checks,
caching to local vars, style mutation, etc.) — these all must continue
working.

### 2. Apply the Deprecation

Use `defineDeprecatedProperty` from `src/lib/litegraph/src/utils/feedback.ts`:

```typescript
import { defineDeprecatedProperty } from '@/lib/litegraph/src/utils/feedback'

/** @deprecated Use {@link obj.newProp} instead. */
defineDeprecatedProperty(
  obj,
  'oldProp',
  'newProp',
  'obj.oldProp is deprecated. Use obj.newProp instead.'
)
```

### 3. Checklist

- [ ] Ecosystem search completed — all usage patterns are compatible
- [ ] `defineDeprecatedProperty` call added after the new property is assigned
- [ ] JSDoc `@deprecated` tag added above the call for IDE support
- [ ] Warning message names both old and new property clearly
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

### 4. PR Comment

Add a PR comment summarizing the ecosystem search results: which repos
use the deprecated property, what access patterns were found, and
confirmation that all patterns are compatible with the ODP getter/setter.

## How `defineDeprecatedProperty` Works

- Creates an `Object.defineProperty` getter/setter on the target object
- Getter returns `this[currentKey]`, setter assigns `this[currentKey]`
- Both log via `warnDeprecated`, which deduplicates (once per unique
  message per session via a `Set`)
- `enumerable: false` keeps the alias out of `Object.keys()` / `for...in`
  / `JSON.stringify`
- `configurable: true` allows further redefinition if needed

## Edge Cases

- **Truthiness checks** (`if (widget.oldProp)`) — works, getter fires
- **Caching to local var** (`const el = widget.oldProp`) — works, warns
  once then the cached ref is used directly
- **Style/property mutation** (`widget.oldProp.style.color = 'red'`) —
  works, getter returns the real object
- **Serialization** (`JSON.stringify`) — `enumerable: false` excludes it
- **Heavy access in loops** — `warnDeprecated` deduplicates, only warns
  once per session regardless of call count
