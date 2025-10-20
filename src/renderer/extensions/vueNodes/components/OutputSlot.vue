<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div v-else v-tooltip.right="tooltipConfig" :class="slotWrapperClass">
    <div class="relative">
      <!-- Slot Name -->
      <span
        v-if="!dotOnly"
        class="lod-toggle text-sm font-normal whitespace-nowrap text-node-component-slot-text"
      >
        {{ slotData.localized_name || slotData.name || `Output ${index}` }}
      </span>
      <LODFallback />
    </div>
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :color="slotColor"
      class="w-3 translate-x-1/2"
      @pointerdown="onPointerDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { cn } from '@/utils/tailwindUtil'

import LODFallback from './LODFallback.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

interface OutputSlotProps {
  nodeType?: string
  nodeId?: string
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  dotOnly?: boolean
}

const props = defineProps<OutputSlotProps>()

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

const { getOutputSlotTooltip, createTooltipConfig } = useNodeTooltips(
  props.nodeType || ''
)

const tooltipConfig = computed(() => {
  const slotName = props.slotData.name || ''
  const tooltipText = getOutputSlotTooltip(props.index)
  const fallbackText = tooltipText || `Output: ${slotName}`
  return createTooltipConfig(fallbackText)
})

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

// Get slot color based on type
const slotColor = computed(() => getSlotColor(props.slotData.type))

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  getSlotKey(props.nodeId ?? '', props.index, false)
)
const shouldDim = computed(() => {
  if (!dragState.active) return false
  return !dragState.compatible.get(slotKey.value)
})

const slotWrapperClass = computed(() =>
  cn(
    'lg-slot lg-slot--output flex items-center justify-end group rounded-l-lg h-6',
    'cursor-crosshair',
    props.dotOnly ? 'lg-slot--dot-only justify-center' : 'pl-6',
    {
      'lg-slot--connected': props.connected,
      'lg-slot--compatible': props.compatible,
      'opacity-40': shouldDim.value
    }
  )
)

const connectionDotRef = ref<ComponentPublicInstance<{
  slotElRef: HTMLElement | undefined
}> | null>(null)
const slotElRef = ref<HTMLElement | null>(null)

// Watch for when the child component's ref becomes available
// Vue automatically unwraps the Ref when exposing it
watchEffect(() => {
  const el = connectionDotRef.value?.slotElRef
  slotElRef.value = el || null
})

useSlotElementTracking({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'output',
  element: slotElRef
})

const { onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'output'
})
</script>
