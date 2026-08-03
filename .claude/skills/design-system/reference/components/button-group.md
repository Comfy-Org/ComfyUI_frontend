# ButtonGroup

**Path:** `src/components/ui/button-group/ButtonGroup.vue`
**Built on:** Reka UI `Primitive`

## Purpose

Layout wrapper that visually joins a row of `Button`s into a single segmented container (overflow-hidden, shared rounded corners).

## Props

| Prop    | Type                      | Default | Notes                      |
| ------- | ------------------------- | ------- | -------------------------- |
| `class` | `HTMLAttributes['class']` | —       | merge with `cn()`          |
| `as`    | `string`                  | `'div'` | forwarded `PrimitiveProps` |

No variants (no `cva`). Static classes: `inline-flex items-stretch overflow-hidden rounded-md`.

## Slots

Default slot — intended to hold `Button` children (not enforced by the component).

## Usage

```vue
<script setup lang="ts">
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import Button from '@/components/ui/button/Button.vue'
</script>

<template>
  <ButtonGroup>
    <Button variant="secondary">Left</Button>
    <Button variant="secondary">Right</Button>
  </ButtonGroup>
</template>
```

## Do

- Use for segmented-control-style action rows (view toggles, aligned action pairs).
- Give each child `Button` the same `variant`/`size` for a clean joined look.

## Don't

- Don't use this for a mutually-exclusive selection state — that's `ToggleGroup`, not `ButtonGroup`.

## Notes

No `.stories.ts`/`.test.ts` exists for this component in the source repo — treat it as a minimal, stable layout primitive.
