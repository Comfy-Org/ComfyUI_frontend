<template>
  <div :style="gridStyle">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const {
  minWidth = '15rem',
  maxWidth = '1fr',
  padding = '0',
  gap = '1rem',
  columns
} = defineProps<{
  /** Minimum width for each grid item (default: 15rem) */
  minWidth?: string
  /** Maximum width for each grid item (default: 1fr) */
  maxWidth?: string
  /** Padding around the grid (default: 0rem) */
  padding?: string
  /** Gap between grid items (default: 1rem) */
  gap?: string
  /** Fixed number of columns (overrides auto-fill with minmax) */
  columns?: number
}>()

const gridStyle = computed(() => {
  const gridTemplateColumns = columns
    ? `repeat(${columns}, 1fr)`
    : `repeat(auto-fill, minmax(${minWidth}, ${maxWidth}))`

  return {
    display: 'grid',
    gridTemplateColumns,
    padding,
    gap
  }
})
</script>
