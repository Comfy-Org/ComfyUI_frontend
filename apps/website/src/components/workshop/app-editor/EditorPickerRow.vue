<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

defineOptions({ inheritAttrs: false })

const {
  label,
  value,
  expanded,
  popup = true,
  labelAbove = false
} = defineProps<{
  label: string
  /** The name of the current option. */
  value: string
  expanded: boolean
  /** Opens its grid in an `EditorPicker`; otherwise the grid unfolds below. */
  popup?: boolean
  /** Sets the label over a framed row, for a row standing on its own. */
  labelAbove?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <span v-if="labelAbove" class="px-1 text-xs text-primary-warm-gray">{{
    label
  }}</span>
  <button
    v-bind="$attrs"
    type="button"
    :aria-haspopup="popup ? 'dialog' : undefined"
    :aria-expanded="expanded"
    :aria-label="`${label}: ${value}`"
    :class="
      cn(
        'flex h-12 w-full items-center gap-3 text-left transition-colors hover:bg-transparency-white-t4 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent',
        labelAbove
          ? 'rounded-xl px-1.5 ring-1 ring-transparency-white-t8 ring-inset'
          : 'rounded-lg px-1',
        expanded && 'bg-transparency-white-t8 hover:bg-transparency-white-t8'
      )
    "
    @click="emit('toggle')"
  >
    <span
      class="grid h-8 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-transparency-white-t4 text-primary-warm-gray ring-1 ring-transparency-white-t8"
    >
      <slot />
    </span>
    <span
      v-if="!labelAbove"
      class="w-14 shrink-0 text-xs text-primary-warm-gray"
      >{{ label }}</span
    >
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
