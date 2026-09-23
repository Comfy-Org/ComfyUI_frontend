<script setup lang="ts">
// The two stills a workflow ships, split where the pointer stands, the way the
// app's own template browser shows them. Side by side each one would be half
// the size; laid over each other they stay whole, and the reader moves the
// seam to see what the workflow changed.
const { still, over, title, split } = defineProps<{
  still: string
  /** The one that sweeps across it, which the registry orders, not us. */
  over: string
  title: string
  /** Where the seam stands, as a percentage of the frame's width. */
  split: number
}>()
</script>

<template>
  <img
    :src="still"
    :alt="title"
    loading="lazy"
    decoding="async"
    draggable="false"
    class="size-full object-cover select-none"
  />
  <img
    :src="over"
    alt=""
    loading="lazy"
    decoding="async"
    draggable="false"
    class="absolute inset-0 size-full object-cover select-none"
    :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
    data-testid="catalogue-card-compare"
  />
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm"
    :style="{ left: `${split}%` }"
  />
</template>
