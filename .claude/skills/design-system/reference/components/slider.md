# Slider

**Path:** `src/components/ui/slider/Slider.vue`
**Built on:** Reka UI `SliderRoot` + `SliderTrack` + `SliderRange` + `SliderThumb`

## Purpose

Draggable single- or multi-thumb range slider for numeric value selection with keyboard support. Thumb count derives from the length of the `modelValue` array (1 value = single thumb, 2 values = range slider).

## Props

All `SliderRootProps` from Reka UI (`modelValue: number[]`, `min`, `max`, `step`, `disabled`, `orientation`, ...), plus:

| Prop         | Type                      | Notes                                      |
| ------------ | ------------------------- | ------------------------------------------ |
| `class`      | `HTMLAttributes['class']` |                                            |
| `rangeClass` | `HTMLAttributes['class']` | extra classes for the filled track segment |
| `thumbClass` | `HTMLAttributes['class']` | extra classes for each thumb               |

`modelValue`/`update:modelValue` come straight from Reka UI (no local `defineModel`).

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Slider from '@/components/ui/slider/Slider.vue'

const value = ref([36])
</script>

<template>
  <Slider v-model="value" :min="0" :max="100" :step="1" class="flex-1" />
</template>
```

Range slider (two thumbs):

```vue
<Slider v-model="range" :min="0" :max="100" />
<!-- range = ref([20, 50]) -->
```

## Do

- Use vertical orientation (`orientation="vertical"`) for compact side-panel controls — supported directly via Reka's prop.

## Don't

- Don't use `Slider` for a fixed, discrete set of options with custom labeling — see `CreditSlider` for that pattern (snapping to named stops).

## Notes

`data-slot="slider" | "slider-track" | "slider-range" | "slider-thumb"` attributes are present for external targeting/testing.
