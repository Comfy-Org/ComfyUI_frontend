# ToggleGroup

**Path:** `src/components/ui/toggle-group/{ToggleGroup,ToggleGroupItem}.vue`, `toggleGroup.variants.ts`
**Built on:** Reka UI `ToggleGroupRoot` / `ToggleGroupItem`

## Purpose

Segmented-control-style group of mutually-exclusive (or multi-select) toggle buttons — e.g. alignment pickers, view-mode switches, size selectors.

## Props

`ToggleGroup`: all `ToggleGroupRootProps` (`type: 'single' | 'multiple'` required, `modelValue`, `rovingFocus?`, `disabled?`, `orientation?`, `loop?`), plus `class?`, `variant?: 'default' | 'outline'` (default `'default'`) — propagates to child items via provide/inject unless a child overrides it.

`ToggleGroupItem`: `value: AcceptableValue` (required), plus `class?`, `variant?` (inherits from group), `size?: 'sm' | 'default' | 'lg'` (default `'default'`).

## Variants

`toggleGroupVariants` (root): `variant: default | outline`.
`toggleGroupItemVariants` (item): `variant: default | outline`; `size: sm | default | lg`.

## Events / v-model

`ToggleGroup` supports plain `v-model` — string for `type="single"`, array for `type="multiple"`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'

const value = ref('center')
</script>

<template>
  <ToggleGroup
    v-model="value"
    type="single"
    class="border border-border-default rounded-lg p-1"
  >
    <ToggleGroupItem value="left">Left</ToggleGroupItem>
    <ToggleGroupItem value="center">Center</ToggleGroupItem>
    <ToggleGroupItem value="right">Right</ToggleGroupItem>
  </ToggleGroup>
</template>
```

Boolean toggle (two values standing in for on/off): use `type="single"` with values `'off'`/`'on'`.

## Do

- Set `variant` once on the group — items inherit it automatically.
- Use `type="multiple"` with an array `v-model` for non-exclusive toggle sets.

## Don't

- Don't use `ToggleGroup` for a single boolean setting — use `Switch`.
- Don't use it for actions (things that _do_ something on click) — it's for state (things that _are_ something), same distinction as radio buttons vs. buttons.
- Don't use `ToggleGroup` for an actual tab-switcher (panels of content swapped by selection) — the real app uses a separate `Tab`/`TabList` component for that. See `patterns/tab-like-controls.md` for all three coexisting "row of options" patterns in this codebase.
