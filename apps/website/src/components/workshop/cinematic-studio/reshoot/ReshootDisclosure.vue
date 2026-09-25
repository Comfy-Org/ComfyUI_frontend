<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  value,
  disabled = false
} = defineProps<{
  label: string
  value: string
  disabled?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <div
    :class="
      cn(
        'rounded-xl ring-1 ring-transparency-white-t8 ring-inset',
        open && 'bg-transparency-white-t4'
      )
    "
  >
    <button
      type="button"
      :aria-expanded="open"
      :disabled
      class="flex h-11 w-full items-center justify-between gap-3 px-3.5 text-[13px] disabled:opacity-40"
      @click="open = !open"
    >
      <span class="font-semibold text-primary-comfy-canvas">{{ label }}</span>
      <span class="flex min-w-0 items-center gap-2 text-primary-warm-gray">
        <span class="truncate">{{ value }}</span>
        <ChevronDown
          :class="
            cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')
          "
          aria-hidden="true"
        />
      </span>
    </button>
    <div v-if="open" class="px-3.5 pt-1 pb-3.5">
      <slot />
    </div>
  </div>
</template>
