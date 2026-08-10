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
  side = 'top',
  sideOffset = 6
} = defineProps<{
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>()
</script>

<template>
  <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
    <TooltipRoot disable-closing-trigger>
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
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
