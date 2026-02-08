<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div
    v-else
    v-tooltip.left="tooltipConfig"
    :class="
      cn(
        'lg-slot lg-slot--input flex items-center group rounded-r-lg m-0',
        'cursor-crosshair',
        dotOnly ? 'lg-slot--dot-only' : 'pr-6',
        {
          'lg-slot--connected': connected,
          'lg-slot--compatible': compatible,
          'opacity-40': shouldDim
        },
        socketless && 'pointer-events-none invisible'
      )
    "
  >
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :class="
        cn(
          '-translate-x-1/2 w-3',
          hasSlotError &&
            'before:ring-2 before:ring-error before:ring-offset-0 before:size-4 before:absolute before:rounded-full before:pointer-events-none'
        )
      "
      :slot-data
      @click="onClick"
      @dblclick="onDoubleClick"
      @pointerdown="onPointerDown"
    />

    <!-- Slot Name -->
    <div class="h-full flex items-center min-w-0">
      <span
        v-if="!dotOnly && !hasNoLabel"
        :class="
          cn(
            'truncate text-node-component-slot-text',
            hasSlotError && 'text-error font-medium'
          )
        "
      >
        {{
          slotData.label ||
          slotData.localized_name ||
          (slotData.name ?? `Input ${index}`)
        }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useExecutionStore } from '@/stores/executionStore'
import { cn } from '@/utils/tailwindUtil'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  nodeType?: string
  nodeId?: string
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  dotOnly?: boolean
  socketless?: boolean
}

const {
  nodeType,
  nodeId,
  slotData,
  index,
  connected,
  compatible,
  dotOnly: dotOnlyProp,
  socketless
} = defineProps<InputSlotProps>()

const hasNoLabel = computed(
  () => !slotData.label && !slotData.localized_name && slotData.name === ''
)
const dotOnly = computed(() => dotOnlyProp || hasNoLabel.value)

const executionStore = useExecutionStore()

const hasSlotError = computed(() => {
  const nodeErrors = executionStore.lastNodeErrors?.[nodeId ?? '']
  if (!nodeErrors) return false

  const slotName = slotData.name
  return nodeErrors.errors.some(
    (error) => error.extra_info?.input_name === slotName
  )
})

const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

const { getInputSlotTooltip, createTooltipConfig } = useNodeTooltips(
  nodeType || ''
)

const tooltipConfig = computed(() => {
  const slotName = slotData.localized_name || slotData.name || ''
  const tooltipText = getInputSlotTooltip(slotName)
  const fallbackText = tooltipText || `Input: ${slotName}`
  return createTooltipConfig(fallbackText)
})

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() => getSlotKey(nodeId ?? '', index, true))
const shouldDim = computed(() => {
  if (!dragState.active) return false
  return !dragState.compatible.get(slotKey.value)
})

const connectionDotRef = ref<ComponentPublicInstance<{
  slotElRef: HTMLElement | undefined
}> | null>(null)
const slotElRef = ref<HTMLElement | null>(null)

watchEffect(() => {
  const el = connectionDotRef.value?.slotElRef
  slotElRef.value = el || null
})

useSlotElementTracking({
  nodeId: nodeId ?? '',
  index,
  type: 'input',
  element: slotElRef
})

const { onClick, onDoubleClick, onPointerDown } = useSlotLinkInteraction({
  nodeId: nodeId ?? '',
  index,
  type: 'input'
})
</script>
