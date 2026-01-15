---
globs:
  - '**/*.vue'
---

# Vue Component Conventions

Applies to all `.vue` files anywhere in the codebase.

## Vue 3 Composition API

- Use `<script setup lang="ts">` for component logic
- Destructure props (Vue 3.5 style with defaults)
- Use `ref`/`reactive` for state
- Use `computed()` for derived state
- Use lifecycle hooks: `onMounted`, `onUpdated`, etc.
- Use `Teleport`/`Suspense` when needed

## Component Communication

- Prefer `emit/@event-name` for state changes (promotes loose coupling)
- Use `defineExpose` only for imperative operations (`form.validate()`, `modal.open()`)
- Proper props and emits definitions

## PrimeVue Migrations

Deprecated components and their replacements:

| Deprecated | Replacement | Import Path |
|------------|-------------|-------------|
| `Dropdown` | `Select` | `primevue/select` |
| `OverlayPanel` | `Popover` | `primevue/popover` |
| `Calendar` | `DatePicker` | `primevue/datepicker` |
| `InputSwitch` | `ToggleSwitch` | `primevue/toggleswitch` |
| `Sidebar` | `Drawer` | `primevue/drawer` |
| `Chips` | `AutoComplete` | `primevue/autocomplete` (with `multiple` enabled, `typeahead` disabled) |
| `TabMenu` | `Tabs` | `primevue/tabs` (without panels) |
| `Steps` | `Stepper` | `primevue/stepper` (without panels) |
| `InlineMessage` | `Message` | `primevue/message` |

## VueUse Composables

Prefer VueUse composables over manual event handling:

- `useElementHover` instead of manual mouseover/mouseout listeners
- `useIntersectionObserver` for visibility detection instead of scroll handlers
- `useFocusTrap` for modal/dialog focus management
- `useEventListener` for auto-cleanup event listeners

Prefer Vue native options when available:

- `defineModel` instead of `useVModel` for two-way binding with props

## Styling

- Use Tailwind CSS only (no `<style>` blocks)
- Use semantic tokens from the design system (e.g., `bg-node-component-surface`)
- Use `cn()` from `@/utils/tailwindUtil` for conditional classes

## Best Practices

- Extract complex conditionals to `computed`
- Implement cleanup for async operations
- Use `vue-i18n` for ALL UI strings
