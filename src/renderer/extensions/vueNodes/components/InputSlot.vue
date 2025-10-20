<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div v-else v-tooltip.left="tooltipConfig" :class="slotWrapperClass">
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :color="slotColor"
      :class="cn('-translate-x-1/2', 'w-3', errorClassesDot)"
      @pointerdown="onPointerDown"
    />

    <!-- Slot Name -->
    <div class="relative">
      <span
        v-if="!dotOnly"
        :class="
          cn('whitespace-nowrap text-sm font-normal lod-toggle', labelClasses)
        "
      >
        {{ slotData.localized_name || slotData.name || `Input ${index}` }}
      </span>
      <LODFallback />
    </div>
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
import { useExecutionStore } from '@/stores/executionStore'
import { cn } from '@/utils/tailwindUtil'

import LODFallback from './LODFallback.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  nodeType?: string
  nodeId?: string
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  dotOnly?: boolean
}

const props = defineProps<InputSlotProps>()

const executionStore = useExecutionStore()

const hasSlotError = computed(() => {
  const nodeErrors = executionStore.lastNodeErrors?.[props.nodeId ?? '']
  if (!nodeErrors) return false

  const slotName = props.slotData.name
  return nodeErrors.errors.some(
    (error) => error.extra_info?.input_name === slotName
  )
})

const errorClassesDot = computed(() => {
  return hasSlotError.value
    ? 'ring-2 ring-error ring-offset-0 rounded-full'
    : ''
})

const labelClasses = computed(() =>
  hasSlotError.value
    ? 'text-error font-medium'
    : 'text-node-component-slot-text'
)

const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

const { getInputSlotTooltip, createTooltipConfig } = useNodeTooltips(
  props.nodeType || ''
)

const tooltipConfig = computed(() => {
  const slotName = props.slotData.localized_name || props.slotData.name || ''
  const tooltipText = getInputSlotTooltip(slotName)
  const fallbackText = tooltipText || `Input: ${slotName}`
  return createTooltipConfig(fallbackText)
})

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const slotColor = computed(() => {
  if (hasSlotError.value) {
    return 'var(--color-error)'
  }
  return getSlotColor(props.slotData.type)
})

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  getSlotKey(props.nodeId ?? '', props.index, true)
)
const shouldDim = computed(() => {
  if (!dragState.active) return false
  return !dragState.compatible.get(slotKey.value)
})

const slotWrapperClass = computed(() =>
  cn(
    'lg-slot lg-slot--input flex items-center group rounded-r-lg h-6',
    'cursor-crosshair',
    props.dotOnly ? 'lg-slot--dot-only' : 'pr-6',
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

watchEffect(() => {
  const el = connectionDotRef.value?.slotElRef
  slotElRef.value = el || null
})

useSlotElementTracking({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'input',
  element: slotElRef
})

const { onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'input'
})
</script>
