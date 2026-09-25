<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const { label, disabled = false } = defineProps<{
  label: string
  disabled?: boolean
}>()
</script>

<template>
  <details
    open
    :class="
      cn(
        'group rounded-2xl border border-transparency-white-t8',
        disabled && 'pointer-events-none opacity-40'
      )
    "
    :aria-disabled="disabled"
  >
    <summary
      class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase select-none hover:text-primary-warm-white [&::-webkit-details-marker]:hidden"
    >
      {{ label }}
      <ChevronDown
        class="size-4 transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="px-4 pb-4">
      <slot />
    </div>
  </details>
</template>
