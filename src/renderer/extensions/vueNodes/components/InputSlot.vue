<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-destructive">
    ⚠️
  </div>
  <div
    v-else
    :data-node-tooltip="tooltipText || undefined"
    data-node-tooltip-side="left"
    :aria-label="standalone ? accessibleName : undefined"
    :data-slot-type="slotData.type"
    :class="
      cn(
        'lg-slot lg-slot--input group m-0 flex items-center rounded-r-lg',
        'cursor-crosshair',
        !props.dotOnly && 'h-5',
        effectiveDotOnly ? 'lg-slot--dot-only' : 'pr-2',
        {
          'lg-slot--connected': props.connected,
          'lg-slot--compatible': isCompatible,
          'opacity-40': shouldDim
        },
        props.socketless && 'pointer-events-none invisible'
      )
    "
    @pointerenter="revealLinks"
    @pointerleave="unrevealLinks"
  >
    <SlotConnectionDot
      :slot-key
      :class="
        cn(
          'w-3 -translate-x-1/2',
          hasError &&
            'before:pointer-events-none before:absolute before:size-4 before:rounded-full before:ring-2 before:ring-destructive before:ring-offset-0'
        )
      "
      :slot-data
      @click="onClick"
      @dblclick="onDoubleClick"
      @pointerdown="onPointerDown"
    />

    <template v-if="!effectiveDotOnly">
      <EditableText
        v-if="isEditing"
        class="h-full min-w-0 content-center"
        data-part="slot-label"
        is-editing
        :model-value="label"
        @cancel="isEditing = false"
        @edit="onEditLabel"
      />
      <span
        v-else
        data-part="slot-label"
        :class="
          cn(
            'block h-full min-w-0 content-center truncate',
            hasError && 'font-medium text-destructive'
          )
        "
        @dblclick="isEditing = true"
      >
        {{ label }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import EditableText from '@comfyorg/design-system/common/EditableText'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { autogrowIoInputDragType } from '@/renderer/core/canvas/links/autogrowGroupDropState'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useSlotLinkReveal } from '@/renderer/extensions/vueNodes/composables/useSlotLinkReveal'
import { cn } from '@comfyorg/tailwind-utils'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

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
  /** The slot is the input's only rendered representation, so the dot carries the accessible name. */
  standalone?: boolean
}

const props = defineProps<InputSlotProps>()

const hasNoLabel = computed(
  () =>
    !props.slotData.label &&
    !props.slotData.localized_name &&
    props.slotData.name === ''
)
const effectiveDotOnly = computed(() => props.dotOnly || hasNoLabel.value)
const label = computed(
  () =>
    props.slotData.label ||
    props.slotData.localized_name ||
    (props.slotData.name ?? `Input ${props.index}`)
)
const accessibleName = computed(
  () =>
    props.slotData.label ||
    props.slotData.localized_name ||
    props.slotData.name ||
    undefined
)
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

const { getInputSlotTooltip } = useNodeTooltips(() => props.nodeType || '')
const tooltipText = computed(() => getInputSlotTooltip(props.slotData))

const { revealLinks, unrevealLinks } = useSlotLinkReveal({
  nodeId: props.nodeId,
  index: props.index,
  type: 'input'
})

onErrorCaptured((error) => {
  unrevealLinks()
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  props.nodeId ? getSlotKey(props.nodeId, props.index, true) : undefined
)
const dragCompatible = computed(() => {
  if (!slotKey.value) return undefined
  if (dragState.active) return !!dragState.compatible.get(slotKey.value)
  const ioInputType = autogrowIoInputDragType.value
  if (ioInputType === undefined) return undefined
  return LiteGraph.isValidConnection(ioInputType, props.slotData.type)
})
const isCompatible = computed(() => props.compatible || dragCompatible.value)
const shouldDim = computed(() => dragCompatible.value === false)

const { onClick, onDoubleClick, onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId,
  index: props.index,
  type: 'input'
})

const isEditing = ref(false)
function onEditLabel(val: string) {
  const canvas = useCanvasStore().getCanvas()
  isEditing.value = false
  if (!props.nodeId) return

  const newLabel = val.trim() || undefined
  const slot = canvas.graph?.getNodeById(props.nodeId)?.inputs?.[props.index]
  if (!slot || slot.label === newLabel) return

  slot.label = newLabel
  canvas.setDirty(true, true)
}
</script>
