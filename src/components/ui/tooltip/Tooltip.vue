<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui'
import { TooltipRoot, useForwardPropsEmits } from 'reka-ui'
import { provide } from 'vue'

import { tooltipOpenOnClickKey } from './tooltipConfig'

const {
  disableClosingTrigger,
  openOnClick = false,
  ...props
} = defineProps<
  Omit<TooltipRootProps, 'disableHoverableContent'> & { openOnClick?: boolean }
>()
const emits = defineEmits<TooltipRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
provide(tooltipOpenOnClickKey, () => openOnClick)
</script>

<template>
  <TooltipRoot
    v-slot="slotProps"
    v-bind="forwarded"
    :disable-closing-trigger="openOnClick || disableClosingTrigger || undefined"
  >
    <slot v-bind="slotProps" />
  </TooltipRoot>
</template>
