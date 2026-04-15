<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { count = 15, columns = 5 } = defineProps<{
  count?: number
  columns?: number
}>()

function cellClass(i: number): string {
  return cn(
    'block size-5 rounded-sm',
    i === 3 || i === 8 || i === 13
      ? 'bg-primary-comfy-yellow'
      : i % 3 === 0
        ? 'bg-primary-comfy-plum'
        : 'bg-secondary-mauve'
  )
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center" aria-hidden="true">
    <div
      :class="cn('grid gap-0.5', `grid-cols-${columns}`)"
      class="transform-[rotateX(55deg)_rotateZ(45deg)]"
    >
      <span v-for="i in count" :key="i" :class="cellClass(i)" />
    </div>
  </div>
</template>
