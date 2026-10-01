<script setup lang="ts" generic="T extends string">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  options,
  columns = 3,
  strip = false
} = defineProps<{
  label: string
  options: readonly { id: T; label: string }[]
  columns?: 3 | 4
  /** One scrolling row instead of a grid. */
  strip?: boolean
}>()

const GRID = { 3: 'grid-cols-3', 4: 'grid-cols-4' } as const
const value = defineModel<T>()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    :class="
      cn(
        'px-1',
        strip
          ? 'flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1'
          : cn('grid gap-x-2 gap-y-3', GRID[columns])
      )
    "
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="value === option.id"
      :class="
        cn(
          'group flex min-w-0 flex-col gap-1.5 text-left focus-visible:outline-none disabled:opacity-40',
          strip && 'w-21 shrink-0'
        )
      "
      @click="value = option.id"
    >
      <span
        :class="
          cn(
            'relative block aspect-video w-full overflow-hidden rounded-lg ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
            value === option.id &&
              'ring-2 ring-primary-comfy-yellow group-hover:ring-primary-comfy-yellow'
          )
        "
      >
        <slot name="tile" :option />
        <span
          v-if="value === option.id"
          class="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink shadow-md shadow-black/40"
          aria-hidden="true"
        >
          <Check class="size-2.5" :stroke-width="3" />
        </span>
      </span>
      <span
        :class="
          cn(
            'truncate px-0.5 text-[11px] text-primary-warm-gray',
            value === option.id && 'text-primary-warm-white'
          )
        "
        >{{ option.label }}</span
      >
    </button>
  </div>
</template>
