# FormattedNumberStepper

**Path:** `src/components/ui/stepper/FormattedNumberStepper.vue`
**Built on:** plain native HTML (not Reka UI)

## Purpose

Numeric input with locale-formatted thousands-grouping display (e.g. "1,234"), plus increment/decrement buttons. Parses and re-formats while typing, preserving cursor position, and clamps to `min`/`max`.

## Props

| Prop            | Type                                    | Default                             |
| --------------- | --------------------------------------- | ----------------------------------- |
| `min`           | `number`                                | `0`                                 |
| `max`           | `number`                                | `Infinity`                          |
| `step`          | `number \| ((value: number) => number)` | `1` (function form = variable step) |
| `formatOptions` | `Intl.NumberFormatOptions`              | `{ useGrouping: true }`             |
| `disabled`      | `boolean`                               | `false`                             |

## Slots

`#prefix`, `#suffix` — rendered beside the input (e.g. a unit label).

## Events / v-model

`defineModel<number>({ required: true })`. Emits `'max-reached': []` when a typed value exceeds `max` and gets clamped.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'

const value = ref(0)
</script>

<template>
  <FormattedNumberStepper v-model="value" :min="0" :max="1000" :step="10">
    <template #suffix>credits</template>
  </FormattedNumberStepper>
</template>
```

## Do

- Use for any numeric field where thousands-grouping readability matters (credits, dimensions, counts).
- Pass a function to `step` for variable step sizing (e.g. finer steps near zero).

## Don't

- Don't use for free-form numeric entry without bounds — plain `Input type="number"` is simpler when `min`/`max`/grouping aren't needed.
- Don't assume this is the stepper used everywhere in the app — the top toolbar's run-count field is a separate, purpose-built component, `BatchCountEdit` (see `components/batch-count-edit.md`), with different layout and doubling/halving instead of a fixed `step`. Check what the surrounding UI actually uses before assuming this one.
