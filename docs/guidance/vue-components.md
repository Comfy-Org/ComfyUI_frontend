---
globs:
  - '**/*.vue'
---

# Vue Component Conventions

Applies to all `.vue` files anywhere in the codebase.

## Vue 3 Composition API

- Use `<script setup lang="ts">` for component logic
- Destructure props (Vue 3.5 style with defaults) like `const { color = 'blue' } = defineProps<...>()`
- Use `ref`/`reactive` for state
- Use `computed()` for derived state
- Use lifecycle hooks: `onMounted`, `onUpdated`, etc.

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
- Use `cn()` from `@comfyorg/tailwind-utils` for conditional classes
- Refer to packages/design-system/src/css/style.css for design tokens and tailwind configuration
- Exception: when third-party libraries render runtime DOM outside Vue templates
  (for example xterm internals inside PrimeVue terminal wrappers), scoped
  `:deep()` selectors are allowed. Add a brief inline comment explaining why the
  exception is required.

## Props, Slots & Reactivity

- Use `watch`/`watchEffect` for side effects; avoid a `ref` + `watch` when a `computed` would work instead
- Use `provide`/`inject` for dependency injection — but not when a Store or a shared composable would be simpler
- Use the Vue 3.5 TypeScript style of default prop declaration:

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

  - Prefer reactive props destructuring to `const props = defineProps<...>`
  - Do not use `withDefaults` or runtime props declaration
  - Do not import Vue macros unnecessarily

- Define slots via template usage, not `defineSlots`
- Use same-name shorthand for slot prop bindings: `:isExpanded` instead of `:is-expanded="isExpanded"`
- Derive component types using `vue-component-type-helpers` (`ComponentProps`, `ComponentSlots`) instead of separate type files
- Be judicious with new refs or other state:
  - If a prop alone accomplishes the design goal, don't add a `ref`
  - If the `ref` or prop can be used directly, don't add a `computed`
  - If a `computed` can name and reuse a derived value, don't use a `watch`

## Best Practices

- Extract complex conditionals to `computed`
- In unmounted hooks, implement cleanup for async operations
