<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  content,
  side = 'top',
  sideOffset = 4,
  delayDuration = 300,
  disabled = false
} = defineProps<{
  content: string
  side?: TooltipContentProps['side']
  sideOffset?: number
  delayDuration?: number
  disabled?: boolean
}>()
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <Tooltip :disabled="disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipContent
        :side
        :side-offset="sideOffset"
        :class="
          cn(
            'rounded-md border border-node-component-tooltip-border bg-node-component-tooltip-surface px-2.5 py-1 text-xs leading-none text-node-component-tooltip shadow-none'
          )
        "
        arrow-class="fill-node-component-tooltip-surface"
      >
        {{ content }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
