<script setup lang="ts">
import type { TooltipTriggerProps } from 'reka-ui'
import {
  TooltipTrigger,
  injectTooltipRootContext,
  useForwardProps
} from 'reka-ui'

const props = defineProps<TooltipTriggerProps>()
const forwarded = useForwardProps(props)
const rootContext = injectTooltipRootContext()

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType === 'touch' || rootContext.disabled.value) return
  rootContext.onTriggerEnter()
}
</script>

<template>
  <TooltipTrigger v-bind="forwarded" @pointerenter="onPointerEnter">
    <slot />
  </TooltipTrigger>
</template>
