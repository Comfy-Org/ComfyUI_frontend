<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <Tooltip v-else :disabled="!tooltipText">
    <TooltipTrigger as-child>
      <div
        :class="slotWrapperClass"
        @pointerenter="revealLinks"
        @pointerleave="unrevealLinks"
      >
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
          :slot-key
          class="w-3 translate-x-1/2"
          :slot-data
          @pointerdown="onPointerDown"
        />
      </div>
    </TooltipTrigger>
    <TooltipContent side="right">{{ tooltipText }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
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

interface OutputSlotProps {
  nodeType?: string
  nodeId?: NodeId
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  dotOnly?: boolean
}

const props = defineProps<OutputSlotProps>()

const hasNoLabel = computed(
  () => !props.slotData.localized_name && props.slotData.name === ''
)
const dotOnly = computed(() => props.dotOnly || hasNoLabel.value)
// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

const { getOutputSlotTooltip } = useNodeTooltips(props.nodeType || '')
const tooltipText = computed(() =>
  getOutputSlotTooltip(props.slotData, props.index)
)

const { revealLinks, unrevealLinks } = useSlotLinkReveal({
  nodeId: props.nodeId,
  index: props.index,
  type: 'output'
})

onErrorCaptured((error) => {
  unrevealLinks()
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  props.nodeId ? getSlotKey(props.nodeId, props.index, false) : undefined
)
const shouldDim = computed(() => {
  if (!dragState.active) return false
  return !slotKey.value || !dragState.compatible.get(slotKey.value)
})

const slotWrapperClass = computed(() =>
  cn(
    'lg-slot lg-slot--output group flex h-5 items-center justify-end rounded-l-lg',
    'cursor-crosshair',
    dotOnly.value ? 'lg-slot--dot-only justify-center' : 'pl-2',
    {
      'lg-slot--connected': props.connected,
      'lg-slot--compatible': props.compatible,
      'opacity-40': shouldDim.value
    }
  )
)

const { onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId,
  index: props.index,
  type: 'output'
})
</script>
