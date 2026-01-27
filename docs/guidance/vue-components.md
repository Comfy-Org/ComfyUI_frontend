---
globs:
  - '**/*.vue'
---

# Vue Component Conventions

Applies to all `.vue` files anywhere in the codebase.

## Vue 3 Composition API

- Use `<script setup lang="ts">` for component logic
- Destructure props (Vue 3.5 style with defaults):

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

- Do not use `withDefaults` or runtime props declaration
- Do not import Vue macros unnecessarily
- Prefer `defineModel` over separate prop/emit for v-model bindings
- Define slots via template usage, not `defineSlots`
- Use same-name shorthand for slot props: `:is-expanded` not `:is-expanded="isExpanded"`
- Derive component types using `vue-component-type-helpers` (`ComponentProps`, `ComponentSlots`)

## State Management

- Use `ref`/`reactive` for state, `computed()` for derived state
- Use lifecycle hooks: `onMounted`, `onUpdated`, etc.
- Prefer `computed` over `watch` when possible
- Prefer `watch`/`watchEffect` only for side effects
- Be judicious with refs — if a prop suffices, don't add a ref
- Use provide/inject only when a Store or shared composable won't work

## Component Communication

- Prefer `emit/@event-name` for state changes (promotes loose coupling)
- Use `defineExpose` only for imperative operations (`form.validate()`, `modal.open()`)
- Proper props and emits definitions

## VueUse Composables

Prefer VueUse composables over manual event handling:

- `useElementHover` instead of manual mouseover/mouseout listeners
- `useIntersectionObserver` for visibility detection instead of scroll handlers
- `useFocusTrap` for modal/dialog focus management
- `useEventListener` for auto-cleanup event listeners

Prefer Vue native options when available:

- `defineModel` instead of `useVModel` for two-way binding with props

## Styling

- Use inline Tailwind CSS only (no `<style>` blocks)
- Use `cn()` from `@/utils/tailwindUtil` for conditional classes
- Refer to packages/design-system/src/css/style.css for design tokens and tailwind configuration

## Best Practices

- Extract complex conditionals to `computed`
- In unmounted hooks, implement cleanup for async operations
