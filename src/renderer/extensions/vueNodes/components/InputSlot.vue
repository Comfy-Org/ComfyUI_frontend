<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div
    v-else
    :class="
      cn(
        'lg-slot lg-slot--input group/slot m-0 flex items-center rounded-r-lg',
        'cursor-crosshair',
        dotOnly ? 'lg-slot--dot-only' : 'pr-6',
        {
          'lg-slot--connected': props.connected,
          'lg-slot--compatible': props.compatible,
          'opacity-40': shouldDim
        },
        props.socketless && 'pointer-events-none invisible'
      )
    "
  >
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      v-tooltip.left="tooltipConfig"
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
      @contextmenu.stop.prevent="startRename"
    />

    <!-- Slot Name -->
    <div class="flex h-full min-w-0 items-center">
      <input
        v-if="isRenaming"
        ref="renameInputRef"
        v-model="renameValue"
        class="m-0 w-full truncate border-none bg-transparent p-0 text-[length:inherit] leading-[inherit] text-node-component-slot-text outline-none"
        @blur="finishRename"
        @keydown.enter.prevent="finishRename"
        @keydown.escape.prevent="cancelRename"
        @click.stop
        @pointerdown.stop
      />
      <span
        v-else-if="!props.dotOnly && !hasNoLabel"
        :class="
          cn(
            'truncate text-node-component-slot-text hover:text-node-component-slot-text-highlight',
            hasError && 'font-medium text-error'
          )
        "
        @dblclick.stop="startRename"
      >
        {{ displayLabel }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, ref, watchEffect } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { app } from '@/scripts/app'
import { cn } from '@/utils/tailwindUtil'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  slotData: INodeSlot
  compatible?: boolean
  connected?: boolean
  dotOnly?: boolean
  hasError?: boolean
  index: number
  nodeType?: string
  nodeId?: string
  socketless?: boolean
}

const props = defineProps<InputSlotProps>()

const displayLabel = computed(
  () =>
    props.slotData.label ||
    props.slotData.localized_name ||
    (props.slotData.name ?? `Input ${props.index}`)
)

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

const { state: dragState } = useSlotLinkDragUIState()
const slotKey = computed(() =>
  getSlotKey(props.nodeId ?? '', props.index, true)
)
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
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'input',
  element: slotElRef
})

const { onClick, onDoubleClick, onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'input'
})

// ── Inline rename ─────────────────────────────────────────────
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename() {
  if (props.slotData.nameLocked) return
  renameValue.value = displayLabel.value
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.select()
  })
}

let renameCommitted = false

function finishRename() {
  if (!isRenaming.value || renameCommitted) return
  renameCommitted = true

  const newLabel = renameValue.value.trim()
  const node = app.canvas?.graph?.getNodeById(props.nodeId ?? '')
  const slot = node?.inputs?.[props.index]

  if (newLabel && newLabel !== displayLabel.value && slot) {
    slot.label = newLabel
    node?.graph?.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT
    })
    app.canvas?.setDirty(true, true)
  }

  nextTick(() => {
    isRenaming.value = false
    renameCommitted = false
  })
}

function cancelRename() {
  isRenaming.value = false
}
</script>
