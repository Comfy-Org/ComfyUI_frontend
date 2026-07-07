<script setup lang="ts">
import { TooltipContent, TooltipPortal } from 'reka-ui'

import { cn } from '../../utils/cn'

const {
  side = 'top',
  sideOffset = 6,
  class: cls
} = defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  class?: string
}>()
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      :side
      :side-offset="sideOffset"
      :class="
        cn(
          'rounded-agent border-agent-border bg-agent-surface-raised text-agent-fg z-50 max-w-xs border px-2.5 py-1.5 text-xs shadow-md',
          cls
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
