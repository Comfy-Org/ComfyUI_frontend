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
- Refer to packages/design-system/src/css/theme.css for design tokens and tailwind configuration
- Exception: when third-party libraries render runtime DOM outside Vue templates
  (for example xterm internals inside terminal wrappers), scoped
  `:deep()` selectors are allowed. State why the exception is required in the
  PR description. Do not add a comment.

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

## Props, Slots & Reactivity

The props/slots/state rules live in the root `AGENTS.md` ("Vue 3 Composition
API"), which is always loaded. In addition:

- Use `watch`/`watchEffect` for side effects; avoid a `ref` + `watch` when a `computed` would work instead
- Prefer reactive props destructuring to `const props = defineProps<...>`; do not import Vue macros unnecessarily
- Use same-name shorthand for slot prop bindings: `:isExpanded` instead of `:is-expanded="isExpanded"`
- Derive component types using `vue-component-type-helpers` (`ComponentProps`, `ComponentSlots`) instead of separate type files

## Best Practices

- Extract complex conditionals to `computed`
- In unmounted hooks, implement cleanup for async operations
