<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'

import Tooltip from './Tooltip.vue'
import TooltipContent from './TooltipContent.vue'
import TooltipTrigger from './TooltipTrigger.vue'

const { text, side } = defineProps<{
  text: string
  side?: TooltipContentProps['side']
}>()
</script>

<template>
  <Tooltip :disabled="!text">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side>
      <slot name="content">{{ text }}</slot>
    </TooltipContent>
  </Tooltip>
</template>
