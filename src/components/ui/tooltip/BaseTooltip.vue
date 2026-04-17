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
  size = 'small',
  keybind,
  showIcon = false,
  delayDuration,
  disabled = false,
  class: className
} = defineProps<{
  text?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  size?: NonNullable<TooltipVariants['size']>
  keybind?: string
  showIcon?: boolean
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
        :class="cn(tooltipVariants({ size }), className)"
      >
        <span
          v-if="keybind || (showIcon && size === 'small')"
          class="inline-flex items-center gap-2"
        >
          <span>{{ text }}</span>
          <i
            v-if="showIcon && size === 'small'"
            class="icon-[lucide--chevron-right] size-4 shrink-0"
          />
          <span
            v-if="keybind"
            class="shrink-0 rounded-sm bg-interface-menu-keybind-surface-default px-1 text-xs leading-none"
          >
            {{ keybind }}
          </span>
        </span>
        <template v-else>{{ text }}</template>
        <TooltipArrow
          :width="8"
          :height="5"
          class="fill-node-component-tooltip-surface stroke-node-component-tooltip-border"
        />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
