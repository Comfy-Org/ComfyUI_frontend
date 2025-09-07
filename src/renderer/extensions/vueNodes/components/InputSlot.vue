<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--input flex items-center cursor-crosshair group rounded-r-lg"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pr-6 hover:bg-black/5 hover:dark:bg-white/5': !dotOnly
    }"
    :style="{
      height: slotHeight + 'px'
    }"
  >
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :color="slotColor"
      class="-translate-x-1/2"
    />

    <!-- Slot Name -->
    <span
      v-if="!dotOnly"
      class="whitespace-nowrap text-sm font-normal dark-theme:text-[#9FA2BD] text-[#888682]"
    >
      {{ slotData.localized_name || slotData.name || `Input ${index}` }}
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  type ComponentPublicInstance,
  computed,
  inject,
  onErrorCaptured,
  ref,
  watchEffect
} from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import {
  COMFY_VUE_NODE_DIMENSIONS,
  INodeSlot,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
// DOM-based slot registration for arbitrary positioning
import {
  type TransformState,
  useDomSlotRegistration
} from '@/renderer/core/layout/slots/useDomSlotRegistration'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  node?: LGraphNode
  nodeId?: string
  slotData: INodeSlot
  index: number
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
  dotOnly?: boolean
}

const props = defineProps<InputSlotProps>()

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

const transformState = inject<TransformState | undefined>(
  'transformState',
  undefined
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

useDomSlotRegistration({
  nodeId: props.nodeId ?? '',
  slotIndex: props.index,
  isInput: true,
  element: slotElRef,
  transform: transformState
})
</script>
