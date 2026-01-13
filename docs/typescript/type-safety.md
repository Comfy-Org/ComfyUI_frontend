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

## Never Use `@ts-ignore` or `@ts-expect-error`

These directives suppress all errors on a line, making it easy to accidentally mask serious bugs. Instead:

1. Fix the underlying type issue
2. Use a type guard to narrow the type
3. If truly unavoidable, use a targeted cast with explanation

❌ **Wrong:**

```typescript
// @ts-expect-error - doesn't work otherwise
node.customProperty = value
```

✅ **Correct:**

```typescript
interface ExtendedNode extends LGraphNode {
  customProperty?: string
}

function isExtendedNode(node: LGraphNode): node is ExtendedNode {
  return 'customProperty' in node
}

if (isExtendedNode(node)) {
  node.customProperty = value
}
```

## Use `unknown` Instead of `any`

When you don't know the type, use `unknown` and narrow with type guards:

❌ **Wrong:**

```typescript
function process(data: any) {
  return data.value  // No type checking
}
```

✅ **Correct:**

```typescript
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return data.value
  }
  return undefined
}
```

## Use Type Annotations for Object Literals

Prefer type annotations over assertions for object literals - this catches refactoring bugs:

❌ **Wrong:**

```typescript
const config = {
  naem: 'test'  // Typo not caught
} as Config
```

✅ **Correct:**

```typescript
const config: Config = {
  naem: 'test'  // Error: 'naem' does not exist on type 'Config'
}
```

## Prefer Interfaces Over Type Aliases for Objects

Use interfaces for object types. While modern TypeScript has narrowed performance differences between interfaces and type aliases, interfaces still offer clearer error messages and support declaration merging:

❌ **Avoid for object types:**

```typescript
type NodeConfig = {
  id: string
  name: string
}
```

✅ **Preferred:**

```typescript
interface NodeConfig {
  id: string
  name: string
}
```

Use type aliases for unions, primitives, and tuples where interfaces don't apply.

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

## Primitive Types

Use lowercase primitive types, never boxed object types:

❌ **Wrong:**

```typescript
function greet(name: String): String
function count(items: Object): Number
```

✅ **Correct:**

```typescript
function greet(name: string): string
function count(items: object): number
```

## Callback Types

### Return Types

Use `void` for callbacks whose return value is ignored:

❌ **Wrong:**

```typescript
interface Options {
  onComplete?: () => any
}
```

✅ **Correct:**

```typescript
interface Options {
  onComplete?: () => void
}
```

### Optional Parameters

Don't make callback parameters optional unless you intend to invoke the callback with varying argument counts:

❌ **Wrong:**

```typescript
interface Callbacks {
  onProgress?: (current: number, total?: number) => void
}
```

✅ **Correct:**

```typescript
interface Callbacks {
  onProgress?: (current: number, total: number) => void
}
```

Callbacks can always ignore parameters they don't need.

## Function Overloads

### Ordering

Put specific overloads before general ones (TypeScript uses first match):

❌ **Wrong:**

```typescript
declare function fn(x: unknown): unknown
declare function fn(x: HTMLElement): HTMLElement
```

✅ **Correct:**

```typescript
declare function fn(x: HTMLElement): HTMLElement
declare function fn(x: unknown): unknown
```

### Prefer Optional Parameters Over Overloads

❌ **Wrong:**

```typescript
interface Example {
  diff(one: string): number
  diff(one: string, two: string): number
  diff(one: string, two: string, three: string): number
}
```

✅ **Correct:**

```typescript
interface Example {
  diff(one: string, two?: string, three?: string): number
}
```

## Generics

Never create a generic type that doesn't use its type parameter:

❌ **Wrong:**

```typescript
declare function fn<T>(): void
```

✅ **Correct:**

```typescript
declare function fn<T>(arg: T): T
```

## Summary

1. **Never use `as`** outside of custom type guards (exception: test files may use `as Partial<T> as T` for partial mocks)
2. **Use `instanceof`** for class/DOM element checks
3. **Use `'prop' in obj`** for property existence checks
4. **Use `typeof`** for primitive type checks
5. **Fix source types** instead of casting at usage sites
6. **Create type guards** for repeated patterns
7. **Use `void`** for ignored callback returns
