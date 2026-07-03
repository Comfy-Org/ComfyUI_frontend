<script setup lang="ts">
import type { TooltipTriggerProps } from 'reka-ui'
import { TooltipTrigger } from 'reka-ui'

const { ...restProps } = defineProps<TooltipTriggerProps>()
</script>

<template>
  <TooltipTrigger v-bind="restProps">
    <slot />
  </TooltipTrigger>
</template>
