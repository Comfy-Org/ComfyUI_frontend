<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'
import { TooltipProvider, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { appTooltipProviderDefaults } from './tooltipConfig'

const {
  delayDuration = appTooltipProviderDefaults.delayDuration,
  ignoreNonKeyboardFocus = appTooltipProviderDefaults.ignoreNonKeyboardFocus,
  ...restProps
} = defineProps<Omit<TooltipProviderProps, 'disableHoverableContent'>>()
const forwarded = useForwardProps(
  computed(() => ({
    ...restProps,
    delayDuration,
    ignoreNonKeyboardFocus,
    disableHoverableContent: appTooltipProviderDefaults.disableHoverableContent
  }))
)
</script>

<template>
  <TooltipProvider v-bind="forwarded">
    <slot />
  </TooltipProvider>
</template>
