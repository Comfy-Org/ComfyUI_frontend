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

Search for both `widget.oldProp` and just `oldProp` to catch all patterns. Use the `comfy_codesearch` tool when it is available; otherwise use GitHub code search:

```bash
gh search code 'oldProp' --language javascript --limit 100
gh search code 'oldProp' --language typescript --limit 100
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
- [ ] `pnpm lint:unstaged:fix` passes on the changed files, and the pre-commit hook (format, lint, typecheck of staged files) passes. Do not run repo-wide `pnpm lint` or `pnpm typecheck`

### 4. PR Comment

Add a PR comment summarizing the ecosystem search results: which repos
use the deprecated property, what access patterns were found, and
confirmation that all patterns are compatible with the ODP getter/setter.

## Edge Cases

- **Truthiness checks** (`if (widget.oldProp)`) — works, getter fires
- **Caching to local var** (`const el = widget.oldProp`) — works, warns
  once then the cached ref is used directly
- **Style/property mutation** (`widget.oldProp.style.color = 'red'`) —
  works, getter returns the real object
- **Serialization** (`JSON.stringify`) — `enumerable: false` excludes it
- **Heavy access in loops** — `warnDeprecated` deduplicates, only warns
  once per session regardless of call count
