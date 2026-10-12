<script setup lang="ts">
import type { TooltipTriggerProps } from 'reka-ui'
import {
  TooltipTrigger,
  injectTooltipProviderContext,
  injectTooltipRootContext,
  useForwardProps
} from 'reka-ui'
import { inject, onBeforeUnmount, ref, watch } from 'vue'

import { tooltipOpenOnClickKey } from './tooltipConfig'

const props = defineProps<TooltipTriggerProps>()
const forwarded = useForwardProps(props)
const rootContext = injectTooltipRootContext()
const providerContext = injectTooltipProviderContext()
const openOnClick = inject(tooltipOpenOnClickKey, () => false)

const hovered = ref(false)
let buttonsHeld = false

watch(rootContext.disabled, (disabled) => {
  if (disabled) rootContext.onClose()
})

watch(rootContext.open, (open) => {
  if (open && buttonsHeld) rootContext.onClose()
})

watch(
  () => hovered.value || rootContext.open.value,
  (active, _, onCleanup) => {
    if (!active) return
    const close = () => rootContext.onClose()
    window.addEventListener('wheel', close, { capture: true, passive: true })
    onCleanup(() =>
      window.removeEventListener('wheel', close, { capture: true })
    )
  }
)

onBeforeUnmount(() => {
  if (rootContext.open.value) providerContext.onClose()
})

function trackButtons(event: PointerEvent) {
  buttonsHeld = event.buttons !== 0
}

function openOnMouseEnter(event: PointerEvent) {
  hovered.value = true
  trackButtons(event)
  if (buttonsHeld || rootContext.disabled.value) return
  rootContext.onTriggerEnter()
}

function openOnClickIfEnabled() {
  if (openOnClick() && !rootContext.disabled.value) rootContext.onOpen()
}
</script>

<template>
  <TooltipTrigger
    v-bind="forwarded"
    @pointerenter="openOnMouseEnter"
    @pointerleave="hovered = false"
    @pointermove="trackButtons"
    @pointerup="trackButtons"
    @click="openOnClickIfEnabled"
  >
    <slot />
  </TooltipTrigger>
</template>
