<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'
import { TooltipProvider, useForwardProps } from 'reka-ui'

import { appTooltipProviderDefaults } from './tooltipConfig'

const {
  delayDuration = appTooltipProviderDefaults.delayDuration,
  ignoreNonKeyboardFocus = appTooltipProviderDefaults.ignoreNonKeyboardFocus,
  ...restProps
} = defineProps<Omit<TooltipProviderProps, 'disableHoverableContent'>>()
const forwarded = useForwardProps(restProps)
</script>

<template>
  <TooltipProvider
    v-bind="forwarded"
    :delay-duration
    :ignore-non-keyboard-focus
    :disable-hoverable-content="
      appTooltipProviderDefaults.disableHoverableContent
    "
  >
    <slot />
  </TooltipProvider>
</template>
