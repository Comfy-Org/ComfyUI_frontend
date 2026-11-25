<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import type { TooltipTriggerProps } from 'reka-ui'
import {
  TooltipTrigger,
  injectTooltipProviderContext,
  injectTooltipRootContext,
  useForwardProps
} from 'reka-ui'
import { inject, onBeforeUnmount, ref, watch } from 'vue'

import { appTooltipProviderDefaults } from './tooltipConfig'
import { tooltipOpenOnClickKey, tooltipSkipDelayKey } from './tooltipContext'

const props = defineProps<TooltipTriggerProps>()
const forwarded = useForwardProps(props)
const rootContext = injectTooltipRootContext()
const providerContext = injectTooltipProviderContext()
const openOnClick = inject(tooltipOpenOnClickKey, () => false)
const skipDelayDuration = inject(tooltipSkipDelayKey, () => 0)

const hovered = ref(false)
let interactionBlocked = false
let touchOrigin: { x: number; y: number } | undefined
const { start: startLongPress, stop: stopLongPress } = useTimeoutFn(
  () => {
    if (!touchOrigin || rootContext.disabled.value) return
    interactionBlocked = false
    rootContext.onOpen()
  },
  appTooltipProviderDefaults.delayDuration,
  { immediate: false }
)

watch(rootContext.disabled, (disabled) => {
  if (disabled) cancelInteraction()
})

watch(
  rootContext.open,
  (open) => {
    if (open && interactionBlocked) rootContext.onClose()
  },
  { flush: 'sync' }
)

useEventListener(
  () => (hovered.value || rootContext.open.value ? window : undefined),
  ['pointerup', 'pointercancel', 'wheel', 'keydown'],
  (event) => {
    if (event instanceof KeyboardEvent) {
      interactionBlocked = false
      return
    }
    if (event.type === 'wheel' || touchOrigin) cancelInteraction()
  },
  { capture: true, passive: true }
)

onBeforeUnmount(() => {
  if (rootContext.open.value) providerContext.onClose()
})

function cancelInteraction() {
  interactionBlocked = true
  touchOrigin = undefined
  stopLongPress()
  rootContext.onClose()
}

function openOnMouseEnter(event: PointerEvent) {
  hovered.value = true
  interactionBlocked = event.pointerType === 'touch' || event.buttons !== 0
  if (interactionBlocked || rootContext.disabled.value) return
  if (skipDelayDuration() === 0) providerContext.isOpenDelayed.value = true
  rootContext.onTriggerEnter()
}

function onPointerDown(event: PointerEvent) {
  if (!rootContext.disableClosingTrigger.value) cancelInteraction()
  if (event.pointerType !== 'touch' || rootContext.disabled.value) return
  touchOrigin = { x: event.clientX, y: event.clientY }
  startLongPress()
}

function onPointerMove(event: PointerEvent) {
  if (touchOrigin) {
    if (
      Math.hypot(event.clientX - touchOrigin.x, event.clientY - touchOrigin.y) >
      10
    ) {
      cancelInteraction()
    }
  } else if (event.buttons !== 0 || interactionBlocked) {
    cancelInteraction()
  }
}

function onPointerLeave() {
  hovered.value = false
  cancelInteraction()
  interactionBlocked = false
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && rootContext.open.value) return
  cancelInteraction()
  if (event.key === 'Tab') interactionBlocked = false
}

function openOnClickIfEnabled() {
  if (!openOnClick() || rootContext.disabled.value) return
  interactionBlocked = false
  rootContext.onOpen()
}
</script>

<template>
  <TooltipTrigger
    v-bind="forwarded"
    @pointerenter="openOnMouseEnter"
    @pointerleave="onPointerLeave"
    @pointerdown.capture="onPointerDown"
    @pointermove.capture="onPointerMove"
    @keydown.capture="onKeyDown"
    @input="cancelInteraction"
    @blur="interactionBlocked = false"
    @click="openOnClickIfEnabled"
  >
    <slot />
  </TooltipTrigger>
</template>
