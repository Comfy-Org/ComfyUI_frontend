<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <BaseTooltip
    v-else
    :text="outputTooltipText"
    side="right"
    size="large"
    :delay-duration="tooltipDelay"
    :disabled="!tooltipsEnabled"
  >
    <div :class="slotWrapperClass">
      <div class="relative flex h-full min-w-0 items-center">
        <!-- Slot Name -->
        <span
          v-if="!props.dotOnly && !hasNoLabel"
          class="truncate text-node-component-slot-text"
        >
          {{
            slotData.label ||
            slotData.localized_name ||
            (slotData.name ?? `Output ${index}`)
          }}
        </span>
      </div>
      <!-- Connection Dot -->
      <SlotConnectionDot
        ref="connectionDotRef"
        class="w-3 translate-x-1/2"
        :slot-data
        @pointerdown="onPointerDown"
      />
    </div>
  </BaseTooltip>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseTooltip from '@/components/ui/tooltip/BaseTooltip.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { cn } from '@/utils/tailwindUtil'

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

const { t } = useI18n()

const hasNoLabel = computed(
  () => !props.slotData.localized_name && props.slotData.name === ''
)
const dotOnly = computed(() => props.dotOnly || hasNoLabel.value)

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

const { getOutputSlotTooltip, tooltipsEnabled, tooltipDelay } = useNodeTooltips(
  props.nodeType || ''
)

const outputTooltipText = computed(() => {
  const slotName = props.slotData.name || ''
  const tooltipText = getOutputSlotTooltip(props.index)
  const fallbackText = tooltipText || `Output: ${slotName}`
  const iterativeSuffix =
    props.slotData.shape === RenderShape.GRID
      ? ` ${t('vueNodesSlot.iterative')}`
      : ''
  return fallbackText + iterativeSuffix
})

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

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
    'lg-slot lg-slot--output group flex h-6 items-center justify-end rounded-l-lg',
    'cursor-crosshair',
    dotOnly.value ? 'lg-slot--dot-only justify-center' : 'pl-6',
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
