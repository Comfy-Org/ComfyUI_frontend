<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--output flex items-center cursor-crosshair justify-end group rounded-l-lg"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pl-6 hover:bg-black/5 hover:dark:bg-white/5': !dotOnly,
      'justify-center': dotOnly
    }"
    :style="{
      height: slotHeight + 'px'
    }"
    @pointerdown="handleClick"
  >
    <!-- Slot Name -->
    <span
      v-if="!dotOnly"
      class="whitespace-nowrap text-sm font-normal dark-theme:text-[#9FA2BD] text-[#888682]"
    >
      {{ slotData.name || `Output ${index}` }}
    </span>

    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :color="slotColor"
      class="translate-x-1/2"
    />
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, inject, onErrorCaptured, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import type { INodeSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { COMFY_VUE_NODE_DIMENSIONS } from '@/lib/litegraph/src/litegraph'
// DOM-based slot registration for arbitrary positioning
import {
  type TransformState,
  useDomSlotRegistration
} from '@/renderer/core/layout/slots/useDomSlotRegistration'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface OutputSlotProps {
  node?: LGraphNode
  nodeId?: string
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
  dotOnly?: boolean
}

const props = defineProps<OutputSlotProps>()

const emit = defineEmits<{
  'slot-click': [event: PointerEvent]
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)

const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

// Get slot color based on type
const slotColor = computed(() => getSlotColor(props.slotData.type))

// Get slot height from litegraph constants
const slotHeight = COMFY_VUE_NODE_DIMENSIONS.components.SLOT_HEIGHT

// Handle click events
const handleClick = (event: PointerEvent) => {
  if (!props.readonly) {
    emit('slot-click', event)
  }
}

const transformState = inject<TransformState | undefined>(
  'transformState',
  undefined
)

const connectionDotRef = ref<{ slotElRef: Ref<HTMLElement> }>()
const slotElRef = ref<HTMLElement | null>(null)

// Watch for connection dot ref changes and sync the element ref
watch(
  connectionDotRef,
  (newValue) => {
    if (newValue?.slotElRef) {
      slotElRef.value = newValue.slotElRef.value
    }
  },
  { immediate: true }
)

useDomSlotRegistration({
  nodeId: props.nodeId ?? '',
  slotIndex: props.index,
  isInput: false,
  element: slotElRef,
  transform: transformState
})
</script>
