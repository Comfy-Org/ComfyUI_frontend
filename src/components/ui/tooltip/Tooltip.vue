<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'

const {
  text,
  side = 'top',
  sideOffset = 5,
  delayDuration = 400,
  disabled = false,
  size = 'sm',
  keybind
} = defineProps<{
  text?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  delayDuration?: number
  disabled?: boolean
  size?: 'sm' | 'lg'
  keybind?: string
}>()
</script>
<template>
  <TooltipProvider
    :delay-duration="delayDuration"
    :disable-hoverable-content="true"
  >
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal v-if="text && !disabled">
        <TooltipContent
          :side
          :side-offset="sideOffset"
          :collision-padding="10"
          :class="
            cn(
              'z-1700 border border-border-default bg-base-background font-normal text-base-foreground shadow-[1px_1px_8px_rgba(0,0,0,0.4)]',
              size === 'sm' &&
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs',
              size === 'lg' && 'max-w-75 rounded-md px-4 py-2 text-sm'
            )
          "
        >
          {{ text }}
          <span
            v-if="keybind && size === 'sm'"
            class="rounded-sm bg-secondary-background px-1 text-xs/4"
          >
            {{ keybind }}
          </span>
          <TooltipArrow
            :width="8"
            :height="5"
            class="fill-base-background stroke-border-default"
          />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
