<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'
import { TooltipProvider, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

const {
  delayDuration = 300,
  disableHoverableContent = true,
  ignoreNonKeyboardFocus = true,
  ...restProps
} = defineProps<TooltipProviderProps>()
const forwarded = useForwardProps(
  computed(() => ({
    delayDuration,
    disableHoverableContent,
    ignoreNonKeyboardFocus,
    ...restProps
  }))
)
</script>

<template>
  <TooltipProvider v-bind="forwarded">
    <slot />
  </TooltipProvider>
</template>
