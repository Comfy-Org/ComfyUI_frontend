<template>
  <div v-if="renderError" class="node-error p-1 text-xs text-red-500">⚠️</div>
  <div
    v-else
    v-tooltip.left="tooltipConfig"
    :class="
      cn(
        'lg-slot lg-slot--input group m-0 flex items-center rounded-r-lg',
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
      <input
        v-if="editing"
        ref="titleInputEl"
        v-model="draft"
        class="min-w-0 rounded-sm border border-border-default bg-base-background px-1 text-node-component-slot-text outline-none"
        @keydown="onTitleKeydown"
        @blur="commit"
        @pointerdown.stop
        @click.stop
        @dblclick.stop
      />
      <span
        v-else-if="!props.dotOnly && !hasNoLabel"
        :class="
          cn(
            'truncate text-node-component-slot-text',
            hasError && 'font-medium text-error',
            isEditable && 'cursor-text'
          )
        "
        @dblclick.stop="startEdit"
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
import {
  computed,
  nextTick,
  onErrorCaptured,
  ref,
  watch,
  watchEffect
} from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { useEditableSlotTitle } from '@/renderer/extensions/vueNodes/composables/useEditableSlotTitle'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { cn } from '@comfyorg/tailwind-utils'

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

const { editing, draft, isEditable, startEdit, commit, cancel } =
  useEditableSlotTitle(
    () => props.nodeId ?? '',
    () => props.slotData.name ?? ''
  )

const titleInputEl = ref<HTMLInputElement | null>(null)
watch(editing, async (active) => {
  if (!active) return
  await nextTick()
  titleInputEl.value?.focus()
  titleInputEl.value?.select()
})

function onTitleKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  }
}

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
</script>
