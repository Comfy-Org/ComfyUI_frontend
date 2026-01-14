---
globs:
  - '**/*.vue'
---

# Vue Component Conventions

Applies to all `.vue` files anywhere in the codebase.

## Component Communication

- Prefer `emit/@event-name` for state changes
- Use `defineExpose` only for imperative operations (`form.validate()`, `modal.open()`)

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
- `useVModel` for two-way binding with props
- `useFocusTrap` for modal/dialog focus management
- `useEventListener` for auto-cleanup event listeners

## Styling

- Use Tailwind CSS only (no `<style>` blocks)
- Use semantic tokens from the design system (e.g., `bg-node-component-surface`)
- Use `cn()` from `@/utils/tailwindUtil` for conditional classes
