<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'
import { TooltipProvider, useForwardProps } from 'reka-ui'
import { provide } from 'vue'

import { appTooltipProviderDefaults } from './tooltipConfig'
import { tooltipSkipDelayKey } from './tooltipContext'

const {
  delayDuration = appTooltipProviderDefaults.delayDuration,
  skipDelayDuration = appTooltipProviderDefaults.skipDelayDuration,
  ignoreNonKeyboardFocus = appTooltipProviderDefaults.ignoreNonKeyboardFocus,
  ...restProps
} = defineProps<Omit<TooltipProviderProps, 'disableHoverableContent'>>()
const forwarded = useForwardProps(restProps)
provide(tooltipSkipDelayKey, () => skipDelayDuration)
</script>

<template>
  <TooltipProvider
    v-bind="forwarded"
    :delay-duration
    :skip-delay-duration
    :ignore-non-keyboard-focus
    :disable-hoverable-content="
      appTooltipProviderDefaults.disableHoverableContent
    "
  >
    <slot />
  </TooltipProvider>
</template>
