<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div
    v-else
    v-tooltip.left="tooltipConfig"
    :class="
      cn(
        'lg-slot lg-slot--input group m-0 flex items-center rounded-r-lg',
        'cursor-crosshair',
        dotOnly ? 'lg-slot--dot-only' : 'h-5 pr-2',
        {
          'lg-slot--connected': props.connected,
          'lg-slot--compatible': props.compatible,
          'opacity-40': shouldDim
        },
        props.socketless && 'pointer-events-none invisible'
      )
    "
    @pointerenter="revealLinks"
    @pointerleave="unrevealLinks"
  >
    <!-- Connection Dot -->
    <SlotConnectionDot
      :slot-key
      :class="
        cn(
          'w-3 -translate-x-1/2',
          hasError &&
            'before:pointer-events-none before:absolute before:size-4 before:rounded-full before:ring-2 before:ring-error before:ring-offset-0'
        )
      "
      :slot-data
      @click="onClick"
      @dblclick="onDoubleClick"
      @pointerdown="onPointerDown"
    />

    <!-- Slot Name -->
    <div class="flex h-full min-w-0 items-center">
      <span
        v-if="!props.dotOnly && !hasNoLabel"
        :class="
          cn(
            'truncate text-node-component-slot-text',
            hasError && 'font-medium text-error'
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
import { computed, onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useSlotLinkReveal } from '@/renderer/extensions/vueNodes/composables/useSlotLinkReveal'
import { cn } from '@comfyorg/tailwind-utils'
import type { NodeId } from '@/types/nodeId'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  slotData: INodeSlot
  compatible?: boolean
  connected?: boolean
  dotOnly?: boolean
  hasError?: boolean
  index: number
  nodeType?: string
  nodeId?: NodeId
  socketless?: boolean
}

const props = defineProps<InputSlotProps>()
const { t } = useI18n()

const hasNoLabel = computed(
  () =>
    !props.slotData.label &&
    !props.slotData.localized_name &&
    props.slotData.name === ''
)
const dotOnly = computed(() => props.dotOnly || hasNoLabel.value)

const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

const { getInputSlotTooltip, createTooltipConfig } = useNodeTooltips(
  props.nodeType || ''
)

const tooltipConfig = computed(() => {
  const inputName = props.slotData.name || ''
  const displayName = props.slotData.localized_name || inputName
  const tooltipText = getInputSlotTooltip(inputName)
  const fallbackText = tooltipText || t('g.inputTooltip', { name: displayName })
  return createTooltipConfig(fallbackText)
})

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  props.nodeId ? getSlotKey(props.nodeId, props.index, true) : undefined
)
const shouldDim = computed(() => {
  if (!dragState.active) return false
  if (!slotKey.value) return false
  return !dragState.compatible.get(slotKey.value)
})

const { onClick, onDoubleClick, onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId,
  index: props.index,
  type: 'input'
})

const { revealLinks, unrevealLinks } = useSlotLinkReveal({
  nodeId: props.nodeId,
  index: props.index,
  type: 'input'
})
</script>
