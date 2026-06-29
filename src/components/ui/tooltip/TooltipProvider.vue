<script setup lang="ts">
import type { TooltipProviderProps } from 'reka-ui'
import { TooltipProvider } from 'reka-ui'

const { ...restProps } = defineProps<TooltipProviderProps>()
</script>

<template>
  <TooltipProvider v-bind="restProps">
    <slot />
  </TooltipProvider>
</template>
