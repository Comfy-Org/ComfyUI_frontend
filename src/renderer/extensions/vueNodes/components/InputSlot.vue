<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div
    v-else
    class="lg-slot lg-slot--input flex items-center cursor-crosshair group rounded-r-lg h-6"
    :class="{
      'opacity-70': readonly,
      'lg-slot--connected': connected,
      'lg-slot--compatible': compatible,
      'lg-slot--dot-only': dotOnly,
      'pr-6 hover:bg-black/5 hover:dark:bg-white/5': !dotOnly
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
  onErrorCaptured,
  ref,
  watchEffect
} from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import { INodeSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'

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
  type: 'input',
  element: slotElRef
})
</script>
