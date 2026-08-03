# ColorPicker

**Path:** `src/components/ui/color-picker/{ColorPicker,ColorPickerPanel,ColorPickerSaturationValue,ColorPickerSlider}.vue`, `useColorPicker.ts`
**Built on:** raw Reka UI `Popover*` primitives (not `ui/popover/*`)

## Purpose

Full HSVA color picker: trigger button (checkerboard-backed swatch + hex/RGB readout) that opens a panel with a saturation/value square, hue slider, optional alpha slider, and hex/RGBA text entry.

## Props (`ColorPicker.vue`)

| Prop       | Type      | Default |
| ---------- | --------- | ------- |
| `class`    | `string`  | —       |
| `disabled` | `boolean` | `false` |
| `alpha`    | `boolean` | `true`  |

`defineModel<string>({ default: '#000000' })` — hex color string.

## Slots

`#trigger` — override the trigger button entirely.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'

const color = ref('#e06cbd')
</script>

<template>
  <ColorPicker v-model="color" />
</template>
```

## Do

- Set `:alpha="false"` when the consuming feature has no concept of transparency — this also hides the alpha slider/field in the panel.

## Don't

- Don't expect `disabled` to lock the popover logic itself — it only disables the trigger button.

## Notes

All pointer-driven controls (saturation/value square, sliders) use native Pointer Events + `setPointerCapture`, not global mousemove listeners.
