# 12. Pure Function Loader Pattern for Extension Registration

Date: 2026-05-12

## Status

Accepted

## Context

The v2 extension API needs a mechanism for extensions to register themselves with the runtime. Two broad approaches exist:

### Side-Effect Registration (Vue 2 Plugin Pattern)

```ts
// Extension self-registers at import time
import { app } from '@comfyorg/core'

app.use({
  install(app) {
    app.component('MyWidget', MyWidget)
    app.directive('my-directive', myDirective)
  }
})
```

Problems:

- **Import order matters**: If extension A depends on extension B being registered first, import order must be carefully managed
- **Hard to test**: Side effects at import time make mocking difficult; tests must manipulate module cache
- **Hard to tree-shake**: Bundlers can't eliminate unused extensions — the import executes
- **Timing coupling**: Registration and activation are conflated; can't collect extensions first, then activate later

### Pure Function + Loader Pattern

```ts
// Extension declares intent — no side effects
export default defineNode({
  name: 'my-extension',
  nodeTypes: ['MyNode'],
  nodeCreated(handle) {
    // ...
  }
})

// App bootstrap activates all registered extensions
startExtensionSystem()
```

## Decision

**Adopt the pure function + loader pattern** for v2 extension registration.

### Implementation

```ts
// Extension Registry (data collection only)
const nodeExtensions: NodeExtensionOptions[] = []

export function defineNode(options: NodeExtensionOptions): void {
  nodeExtensions.push(options)
}

// Loader (activation)
export function startExtensionSystem(): void {
  const world = getWorld()
  watch(
    () => world.entitiesWith(NodeTypeKey),
    (nodeEntityIds) => {
      for (const id of nodeEntityIds) {
        mountExtensionsForNode(id)
      }
    },
    { immediate: true }
  )
}
```

### Key Properties

1. **Pure registration**: `defineNode()` has no side effects beyond pushing to an array. It doesn't touch the World, DOM, or any reactive state.

2. **Centralized activation**: `startExtensionSystem()` is called exactly once during app bootstrap. This single entry point controls when the extension system "goes live".

3. **Reactive mounting**: The loader watches the World for entity changes. Extensions are mounted/unmounted in response to ECS state, not imperative calls.

4. **Order independence**: Extensions can be defined in any order. The loader sorts by name (lexicographic, see D10b) for deterministic execution.

### Registration Flow

```
Extension files         App bootstrap           World
      |                      |                   |
      |  defineNode({...})   |                   |
      |--------------------->|                   |
      |     (push to array)  |                   |
      |                      |                   |
      |                      | startExtensionSystem()
      |                      |------------------>|
      |                      |   (watch for NodeType entities)
      |                      |                   |
      |                      |   NodeType added  |
      |                      |<------------------|
      |                      |                   |
      |                      | mountExtensionsForNode(id)
      |                      |   (runs setup)    |
```

## Consequences

### Positive

- **Testability**: Extensions are plain objects; tests can construct them without side effects. `_clearExtensionsForTesting()` resets state between tests.
- **Tree-shakeable**: Bundlers can eliminate unused extension files if their exports are never referenced.
- **Order independent**: No import order bugs — the loader handles activation order.
- **Lazy activation**: Registration is instant; activation only happens when `startExtensionSystem()` is called.
- **SSR friendly**: Pure functions don't execute browser-only code at import time.

### Negative

- **Manual bootstrap**: App must call `startExtensionSystem()` — forgetting it silently disables extensions.
- **Two-step mental model**: Developers must understand "register" vs "activate" phases.

### Mitigations

- App bootstrap is a well-defined location; the call is hard to miss.
- Clear documentation and starter templates include the bootstrap call.
- Dev-mode warnings if extensions are defined but the system never starts.

## Notes

This pattern aligns with modern framework conventions:

- **Vite plugins**: `vite.config.ts` collects plugins as an array; Vite activates them at build time.
- **Vue 3 Composition API**: `setup()` returns reactive state; the framework activates it.
- **React hooks**: Pure functions declare effects; React schedules them.

The key insight is separating **declaration** (what do I want?) from **execution** (make it happen). This separation enables testing, lazy loading, and predictable behavior.
