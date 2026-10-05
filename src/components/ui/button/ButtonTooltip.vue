<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

const { text, side } = defineProps<{
  text: string
  side?: TooltipContentProps['side']
}>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side>{{ text }}</TooltipContent>
  </Tooltip>
</template>
