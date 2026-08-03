# Button

**Path:** `src/components/ui/button/Button.vue`
**Built on:** Reka UI `Primitive` (polymorphic — can render as any element)

## Purpose

General-purpose clickable action control. Supports style variants, sizes, a built-in loading state, and disabling. Use for every clickable action (submit, cancel, icon actions, links styled as buttons) instead of a raw `<button>`.

## Props

| Prop       | Type                        | Default       | Notes                                               |
| ---------- | --------------------------- | ------------- | --------------------------------------------------- |
| `variant`  | `ButtonVariants['variant']` | `'secondary'` | see Variants                                        |
| `size`     | `ButtonVariants['size']`    | `'md'`        | see Variants                                        |
| `loading`  | `boolean`                   | `false`       | disables the button and swaps content for a spinner |
| `disabled` | `boolean`                   | `false`       |                                                     |
| `class`    | `HTMLAttributes['class']`   | —             | merge with `cn()`                                   |
| `as`       | `string`                    | `'button'`    | Reka `Primitive` — render as `a`, `label`, etc.     |
| `asChild`  | `boolean`                   | `false`       | merge props onto a single child element instead     |

## Variants

`variant`: `secondary | primary | inverted | destructive | textonly | muted-textonly | destructive-textonly | link | overlay-white | base | tertiary | subscribe`

`size`: `sm | md | lg | icon-sm | icon | icon-lg | unset`

## Slots

Default slot — button content, hidden while `loading` (replaced by a spinner).

## Usage

```vue
<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
</script>

<template>
  <Button variant="primary" size="lg" @click="onSubmit">Save</Button>

  <Button variant="secondary" size="icon" aria-label="Settings">
    <i class="icon-[lucide--settings]" />
  </Button>

  <Button variant="secondary" :loading="isSaving">Saving…</Button>
</template>
```

## Do

- Pick `variant` by intent: `primary` for the one main action on a screen, `secondary` for everything else, `destructive` for irreversible/dangerous actions, `textonly`/`muted-textonly`/`link` for low-emphasis actions.
- Use `size="icon"` / `icon-sm` / `icon-lg` for icon-only buttons and always add `aria-label`.
- Use the `loading` prop for in-flight async actions instead of a separate spinner — it disables the button for you.
- Let SVG icons inside the slot go unsized (no `width`/`height`) — they auto-size to `size-4`.

## Don't

- Don't build a custom `<button>` with Tailwind classes when `Button` covers the case.
- Don't set both `loading` and manually toggle `disabled` for the same condition — `loading` already forces disabled.
- Don't use `size="unset"` unless you are intentionally overriding all sizing via `class`.

## Notes

Used internally as the base for `MultiSelect`'s "Clear all" button, `SearchInput`'s clear button, `TagsInputItemDelete`, `DialogClose`, `DialogMaximize`, `Pagination`'s prev/next/page buttons. If you're building a new composite control with a clickable affordance, compose `Button` rather than re-styling a native element.
