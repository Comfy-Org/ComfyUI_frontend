<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

import {
  AGENT_REKA_TOOLTIP_CONTENT_CLASS,
  AGENT_REKA_TOOLTIP_PROVIDER_PROPS
} from '@/composables/useTooltipConfig'

const {
  label,
  shortcut,
  disabled = false,
  side = 'top',
  sideOffset = 6
} = defineProps<{
  label: string
  /** Key hint rendered after the label in a muted tone, e.g. "Esc". */
  shortcut?: string
  disabled?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()
</script>

<template>
  <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
    <TooltipRoot :disabled disable-closing-trigger>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side
          :side-offset
          :collision-padding="8"
          :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS"
        >
          {{ label }}
          <span v-if="shortcut" class="ml-1 text-[#fafafa]/50">{{
            shortcut
          }}</span>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
