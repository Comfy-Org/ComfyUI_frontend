---
globs:
  - '**/*.vue'
---

# Vue Component Conventions

## Props, Models and Slots

- Declare props with Vue 3.5 reactive destructuring and inline defaults, never
  `withDefaults`, runtime declarations, or `const props = defineProps<...>()`:

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

- Use `defineModel` for v-model bindings instead of a prop plus emit or
  `useVModel`.
- Define slots through template usage, not `defineSlots`.
- Use same-name shorthand for slot prop bindings: `:isExpanded` instead of
  `:is-expanded="isExpanded"`.
- Derive component types with `vue-component-type-helpers` (`ComponentProps`,
  `ComponentSlots`) instead of separate type files.

## State and Communication

- Prefer a prop to a `ref`, the prop or `ref` directly to a `computed`, and a
  `computed` to a `watch`.
- Use `provide`/`inject` only when a store or shared composable would not be
  simpler.
- Use `defineExpose` only for imperative operations (`form.validate()`,
  `modal.open()`).

## Styling

- Use inline Tailwind only, no `<style>` blocks. Exception: when a third-party
  library renders DOM outside Vue templates (for example xterm internals),
  scoped `:deep()` selectors are allowed; state why in the PR description.
- Merge classes with `cn()` from `@comfyorg/tailwind-utils`, inline in the
  template when feasible, never `:class="[]"`.
- Never use `!important` or the `!` prefix. Fix the existing `!important`
  class that interferes instead.
- Use fraction utilities (`w-1/2`, `w-4/5`) instead of arbitrary percentages
  such as `w-[50%]`.
- Size `icon-[...]` icons with `size-*`, never font-size classes such as
  `text-xs`; font size has no effect on them.
- Design tokens live in `packages/design-system/src/css/theme.css`.
