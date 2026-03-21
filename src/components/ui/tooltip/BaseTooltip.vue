<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

import type { TooltipVariants } from '@/components/ui/tooltip/tooltip.variants'
import { tooltipVariants } from '@/components/ui/tooltip/tooltip.variants'
import { cn } from '@/utils/tailwindUtil'

const {
  text = '',
  side = 'top',
  sideOffset = 4,
  variant = 'default',
  delayDuration,
  disabled = false,
  class: className
} = defineProps<{
  text?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  variant?: NonNullable<TooltipVariants['variant']>
  delayDuration?: number
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <TooltipRoot :delay-duration="delayDuration" :disabled="disabled || !text">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="sideOffset"
        :class="cn(tooltipVariants({ variant }), className)"
      >
        {{ text }}
        <TooltipArrow
          v-if="variant !== 'default'"
          :width="8"
          :height="5"
          class="fill-node-component-tooltip-surface"
        />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
