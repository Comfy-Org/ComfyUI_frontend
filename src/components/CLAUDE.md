# Component Guidelines

## Vue 3 Composition API

- Use setup() function
- Destructure props (Vue 3.5 style)
- Use ref/reactive for state
- Implement computed() for derived state
- Use provide/inject for dependency injection

## Component Communication

- Prefer `emit/@event-name` for state changes
- Use `defineExpose` only for imperative operations (`form.validate()`, `modal.open()`)
- Events promote loose coupling

## UI Framework

- Deprecated PrimeVue component replacements:
  - Dropdown → Select
  - OverlayPanel → Popover
  - Calendar → DatePicker
  - InputSwitch → ToggleSwitch
  - Sidebar → Drawer
  - Chips → AutoComplete with multiple enabled
  - TabMenu → Tabs without panels
  - Steps → Stepper without panels
  - InlineMessage → Message

## Styling

- Use Tailwind CSS only (no custom CSS)
- Dark theme: use "dark-theme:" prefix
- For common operations, try to use existing VueUse composables that automatically handle effect scope
  - Example: Use `useElementHover` instead of manually managing mouseover/mouseout event listeners
  - Example: Use `useIntersectionObserver` for visibility detection instead of custom scroll handlers

## Best Practices

- Extract complex conditionals to computed
- Implement cleanup for async operations
- Use vue-i18n for ALL UI strings
- Use lifecycle hooks: onMounted, onUpdated
- Use Teleport/Suspense when needed
- Proper props and emits definitions
