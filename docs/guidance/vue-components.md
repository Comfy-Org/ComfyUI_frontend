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

## Rendered markup

- Give each wrapper a job. Put classes or text on an existing element when it
  can do the same work. Use a fragment when grouping is only for the template.
- Before removing a wrapper, check layout, accessible names, keyboard focus,
  hit areas, tooltip anchors, and measurements that depend on it. For a root
  change, check where fallthrough attributes and listeners land.
- For markup that repeats per node, slot, or widget, compare the rendered
  element count before and after on the same workflow and UI states. In review,
  explain what any added wrapper does and verify that affected interactions
  still work. A lower count alone does not establish a speedup.

Use `pnpm audit:vue-wrappers` to list single-child `div` and `span` wrappers in
Vue nodes. Pass tracked files or directories to scan a different scope. The
report lists candidates, not violations, and does not change files.
Use `pnpm --silent audit:vue-wrappers --json` for JSON on stdout.

To try a removal in Chromium, run `pnpm audit:vue-wrapper-mutations` with a
disposable [local E2E backend](../../browser_tests/README.md#setup) running.
The pilot serves the default workflow in each arm and applies the edits only
in Vite, without changing the Vue files. It repeats the baseline, checks a past
label cleanup and a deliberately broken collapse control, then reports what
changed for the input-slot candidate. The versioned `report.json` in the
printed capture directory contains the verdicts, element deltas, and relative
paths to the raw captures. A survivor only passed the states and interactions the
pilot exercised; it is neither a safety guarantee nor a timing benchmark.

Pass `--layout` to also collect Chromium layout and style recalculation
counts and durations on the same larger graph in each arm except the
deliberately broken control. The optional pass uses the shared pan and zoom
gesture harness and saves raw measurements. Treat a single pass as diagnostic:
layout counters do not measure compositor rebuilds or establish a speedup.

See [Keep Vue node markup small](../adr/RENDERING-DOM-0062-keep-vue-node-markup-small.md).
