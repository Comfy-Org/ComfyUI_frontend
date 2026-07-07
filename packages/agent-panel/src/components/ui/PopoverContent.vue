<script setup lang="ts">
import { PopoverContent, PopoverPortal } from 'reka-ui'

import { cn } from '../../utils/cn'

const {
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  class: cls
} = defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  class?: string
}>()
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      :side
      :align
      :side-offset="sideOffset"
      :class="
        cn(
          'rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg z-50 w-72 border p-3 shadow-xl focus:outline-none',
          cls
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
