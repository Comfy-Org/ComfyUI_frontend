<template>
  <TooltipTrigger as-child :reference="target ?? undefined">
    <span hidden />
  </TooltipTrigger>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import {
  TooltipTrigger,
  injectTooltipProviderContext,
  injectTooltipRootContext
} from 'reka-ui'
import { onBeforeUnmount, watch } from 'vue'

const { container } = defineProps<{ container: HTMLElement | null }>()
const target = defineModel<HTMLElement | null>({ required: true })

const rootContext = injectTooltipRootContext()
const providerContext = injectTooltipProviderContext()
const { onClose: close } = rootContext

watch(target, (element) => {
  if (!element) {
    rootContext.onTriggerChange(undefined)
    close()
  }
})

onBeforeUnmount(() => {
  if (rootContext.open.value) providerContext.onClose()
})

function findTarget(event: Event): HTMLElement | null {
  if (!(event.target instanceof Element)) return null
  const found = event.target.closest<HTMLElement>(
    '[data-node-tooltip]:not([data-node-tooltip=""]), [data-node-tooltip-title]:not([data-node-tooltip-title=""])'
  )
  return found && container?.contains(found) ? found : null
}

function setTarget(next: HTMLElement) {
  target.value = next
  rootContext.onTriggerChange(next)
}

function leave() {
  if (!target.value) return
  target.value = null
  rootContext.onTriggerLeave()
}

watch(
  [target, rootContext.open],
  ([element, open], _, onCleanup) => {
    if (!element || !open) return
    element.setAttribute('aria-describedby', rootContext.contentId)
    onCleanup(() => element.removeAttribute('aria-describedby'))
  },
  { flush: 'sync' }
)

useEventListener(
  () => container,
  'pointermove',
  (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const next = findTarget(event)
    if (next === target.value) return
    leave()
    if (!next || event.buttons !== 0) return
    if (providerContext.isPointerInTransitRef.value) return
    setTarget(next)
    rootContext.onTriggerEnter()
  },
  { capture: true, passive: true }
)
useEventListener(() => container, 'pointerleave', leave)
useEventListener(() => container, 'pointerdown', close, { capture: true })
useEventListener(() => container, 'click', close, { capture: true })
useEventListener(() => container, 'wheel', close, {
  capture: true,
  passive: true
})
</script>
