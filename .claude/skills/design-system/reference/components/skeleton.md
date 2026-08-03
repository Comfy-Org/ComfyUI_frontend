# Skeleton

**Path:** `src/components/ui/skeleton/Skeleton.vue`

## Purpose

Pulsing placeholder block for loading states. Renders `<div class="animate-pulse rounded-md bg-secondary-background" />`.

## Props

| Prop    | Type                      |
| ------- | ------------------------- |
| `class` | `HTMLAttributes['class']` |

No other props, no slots, no variants.

## Usage

```vue
<script setup lang="ts">
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
</script>

<template>
  <div class="flex flex-col gap-2">
    <Skeleton class="h-4 w-3/4" />
    <Skeleton class="h-3 w-1/2" />
  </div>
</template>
```

## Do

- Shape skeletons to mimic the real content's layout (a title-line + N body-lines + a footer chip, matching an actual card) rather than one generic block — see `patterns/loading-states.md`.

## Don't

- Don't use `Skeleton` for a single async button/action — use `Button`'s `loading` prop instead; reserve `Skeleton` for list/grid/card content that hasn't loaded yet.
