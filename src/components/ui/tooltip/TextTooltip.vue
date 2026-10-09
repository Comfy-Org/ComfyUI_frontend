<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'

import Tooltip from './Tooltip.vue'
import TooltipContent from './TooltipContent.vue'
import TooltipTrigger from './TooltipTrigger.vue'

const { text, side, label } = defineProps<{
  text: string
  label?: string
  side?: TooltipContentProps['side']
}>()
</script>

<template>
  <Tooltip :disabled="!text">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side :aria-label="text === label ? ' ' : text">
      <slot name="content">{{ text }}</slot>
    </TooltipContent>
  </Tooltip>
</template>
