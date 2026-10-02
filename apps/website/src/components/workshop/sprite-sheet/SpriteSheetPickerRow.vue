<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  title,
  value,
  expanded,
  popup = true
} = defineProps<{
  title: string
  value: string
  expanded: boolean
  /** Opens its grid over the stage; otherwise the grid unfolds below. */
  popup?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-haspopup="popup ? 'dialog' : undefined"
    :aria-expanded="expanded"
    :class="
      cn(
        'flex h-12 w-full items-center gap-3 rounded-lg px-1 text-left transition-colors hover:bg-transparency-white-t4 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent',
        expanded && 'bg-transparency-white-t8 hover:bg-transparency-white-t8'
      )
    "
    @click="emit('toggle')"
  >
    <span
      class="h-8 w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-transparency-white-t8"
    >
      <slot />
    </span>
    <span class="w-14 shrink-0 text-xs text-primary-warm-gray">{{
      title
    }}</span>
    <span
      class="min-w-0 flex-1 truncate text-[13px] font-semibold text-primary-warm-white"
      >{{ value }}</span
    >
    <ChevronRight
      :class="
        cn(
          'size-4 shrink-0 text-primary-warm-gray transition-transform',
          !popup && expanded && 'rotate-90'
        )
      "
      aria-hidden="true"
    />
  </button>
</template>
