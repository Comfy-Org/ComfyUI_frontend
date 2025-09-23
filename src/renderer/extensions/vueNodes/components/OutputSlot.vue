<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--output flex items-center cursor-crosshair justify-end group rounded-l-lg h-6"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pl-6 hover:bg-black/5 hover:dark:bg-white/5': !dotOnly,
      'justify-center': dotOnly
    }"
  >
    <!-- Slot Name -->
    <span
      v-if="!dotOnly"
      class="whitespace-nowrap text-sm font-normal dark-theme:text-slate-200 text-stone-200"
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
import type { INodeSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
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
  isInput: false,
  element: slotElRef,
  transform: transformState
})
</script>
