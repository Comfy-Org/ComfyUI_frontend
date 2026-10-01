<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  options,
  columns = 3,
  square = false
} = defineProps<{
  label: string
  options: readonly { id: T; label: string }[]
  columns?: 3 | 4
  /** Square tiles, for pictures of things rather than scenes. */
  square?: boolean
}>()

const GRID = { 3: 'grid-cols-3', 4: 'grid-cols-4' } as const
const value = defineModel<T>()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    :class="cn('grid gap-x-2.5 gap-y-3.5 px-1', GRID[columns])"
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="value === option.id"
      class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
      @click="value = option.id"
    >
      <span
        :class="
          cn(
            'relative block w-full overflow-hidden rounded-lg ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
            square ? 'aspect-square' : 'aspect-video',
            value === option.id &&
              'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
          )
        "
      >
        <slot name="tile" :option />
      </span>
      <span
        :class="
          cn(
            'truncate text-xs text-primary-warm-gray group-hover:text-primary-comfy-canvas',
            value === option.id && 'text-primary-warm-white'
          )
        "
        >{{ option.label }}</span
      >
    </button>
  </div>
</template>
