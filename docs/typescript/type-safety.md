---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# Type Safety Rules

## Never Use Type Assertions (`as`)

Type assertions bypass TypeScript's type checking. Instead, use proper type guards and narrowing.

### DOM Elements

❌ **Wrong:**
```typescript
const el = e.target as HTMLInputElement
el.value
```

✅ **Correct:**
```typescript
if (e.target instanceof HTMLInputElement) {
  e.target.value
}
```

### Optional Properties on Objects

❌ **Wrong:**
```typescript
const obj = value as { prop?: string }
if (obj.prop) { ... }
```

✅ **Correct:**
```typescript
if ('prop' in value && typeof value.prop === 'string') {
  value.prop
}
```

### Constructor/Static Properties

❌ **Wrong:**
```typescript
const ctor = node.constructor as { type?: string }
const type = ctor.type
```

✅ **Correct:**
```typescript
const ctor = node.constructor
const type = 'type' in ctor && typeof ctor.type === 'string' ? ctor.type : undefined
```

## Fix the Source Type, Don't Cast

When you find yourself needing a cast, ask: "Can I fix the type definition instead?"

### Missing Interface Properties

If a property exists at runtime but not in the type, add it to the interface:

❌ **Wrong:**
```typescript
const box = this.search_box as { close?: () => void }
box?.close?.()
```

✅ **Correct:**
```typescript
// Update the type definition
search_box?: HTMLDivElement & ICloseable

// Then use directly
this.search_box?.close()
```

### Callback Parameter Types

If a callback receives a different type than declared, fix the callback signature:

❌ **Wrong:**
```typescript
onDrawTooltip?: (link: LLink) => void
// Later...
onDrawTooltip(link as LLink)  // link is actually LinkSegment
```

✅ **Correct:**
```typescript
onDrawTooltip?: (link: LinkSegment) => void
// Later...
onDrawTooltip(link)  // No cast needed
```

## Create Type Guard Functions

For repeated type checks, create reusable type guards:

```typescript
interface IPanel extends Element, ICloseable {
  node?: LGraphNode
  graph?: LGraph
}

function isPanel(el: Element): el is IPanel {
  return 'close' in el && typeof el.close === 'function'
}

// Usage
for (const panel of panels) {
  if (!isPanel(panel)) continue
  panel.close()  // TypeScript knows panel is IPanel
}
```

## When Casts Are Unavoidable

Some casts are genuinely unavoidable. Document why:

```typescript
/**
 * @deprecated Prefer {@link structuredClone}
 * Note: JSON.parse returns `unknown`, so type assertions are unavoidable here.
 * This function is deprecated precisely because it cannot be made type-safe.
 */
cloneObject<T>(obj: T): T {
  const cloned: unknown = JSON.parse(JSON.stringify(obj))
  return cloned as T  // Unavoidable - JSON.parse returns unknown
}
```

### Acceptable Cast Scenarios

1. **`JSON.parse` results** - Returns `unknown`, must be cast
2. **Conditional types in return positions** - TypeScript can't always narrow these
3. **Third-party library limitations** - When you can't fix the source types

## Prefer Specific Over General

Use the most specific type possible:

❌ **Wrong:**
```typescript
const value = obj as any
const value = obj as unknown
const value = obj as Record<string, unknown>
```

✅ **Correct:**
```typescript
// Use the actual expected type
const value: ISerialisedNode = obj
// Or use type guards to narrow
if (isSerialisedNode(obj)) { ... }
```

## Union Types and Narrowing

For union types, use proper narrowing instead of casting:

❌ **Wrong:**
```typescript
// NodeId = number | string
(node.id as number) - (other.id as number)
```

✅ **Correct:**
```typescript
if (typeof node.id === 'number' && typeof other.id === 'number') {
  node.id - other.id
}
```

## Summary

1. **Never use `as`** unless absolutely unavoidable
2. **Use `instanceof`** for class/DOM element checks
3. **Use `'prop' in obj`** for property existence checks
4. **Use `typeof`** for primitive type checks
5. **Fix source types** instead of casting at usage sites
6. **Create type guards** for repeated patterns
7. **Document unavoidable casts** with clear explanations
