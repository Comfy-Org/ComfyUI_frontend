<script setup lang="ts">
import type { TooltipTriggerProps } from 'reka-ui'
import {
  TooltipTrigger,
  injectTooltipProviderContext,
  injectTooltipRootContext,
  useForwardProps
} from 'reka-ui'
import { inject, watch } from 'vue'

import { tooltipOpenOnClickKey } from './tooltipConfig'

const props = defineProps<TooltipTriggerProps>()
const forwarded = useForwardProps(props)
const rootContext = injectTooltipRootContext()
const providerContext = injectTooltipProviderContext()
const openOnClick = inject(tooltipOpenOnClickKey, () => false)

watch(rootContext.disabled, (disabled) => {
  if (disabled) rootContext.onClose()
})

watch(rootContext.open, (open, _, onCleanup) => {
  if (!open) return
  const close = () => rootContext.onClose()
  window.addEventListener('wheel', close, { capture: true, passive: true })
  onCleanup(() => window.removeEventListener('wheel', close, { capture: true }))
})

function openOnMouseEnter(event: PointerEvent) {
  if (
    event.pointerType === 'touch' ||
    event.buttons !== 0 ||
    rootContext.disabled.value ||
    providerContext.isPointerInTransitRef.value
  )
    return
  rootContext.onTriggerEnter()
}

function openOnClickIfEnabled() {
  if (openOnClick()) rootContext.onOpen()
}
</script>

<template>
  <TooltipTrigger
    v-bind="forwarded"
    @pointerenter="openOnMouseEnter"
    @click="openOnClickIfEnabled"
  >
    <slot />
  </TooltipTrigger>
</template>
