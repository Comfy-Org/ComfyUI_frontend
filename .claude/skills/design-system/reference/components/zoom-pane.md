# ZoomPane

**Path:** `src/components/ui/ZoomPane.vue`

## Purpose

Generic pan/zoom viewport container. Captures wheel (zoom) and pointer-drag (pan) gestures and exposes a CSS `transform: matrix(...)` string via a scoped slot, letting the consumer apply it to arbitrary content (previews, zoomable canvases).

## Props

None.

## Slots

Default — scoped, receives `{ style: { transform: string } }`.

## Usage

```vue
<script setup lang="ts">
import ZoomPane from '@/components/ui/ZoomPane.vue'
</script>

<template>
  <ZoomPane v-slot="{ style }">
    <img :style="style" src="/preview.png" alt="" />
  </ZoomPane>
</template>
```

## Do

- Use for any zoomable/pannable media preview.

## Don't

- Don't expect built-in zoom-level or pan-bounds clamping beyond the hardcoded internal limits — there is no `min-zoom`/`max-pan` prop.

## Notes

Pan is unbounded; zoom is internally clamped. Not built on Reka UI — a bespoke gesture-handling primitive.
