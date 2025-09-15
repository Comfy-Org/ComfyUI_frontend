<template>
  <div v-if="renderError" class="node-error p-1 text-red-500 text-xs">⚠️</div>
  <div v-else v-tooltip.left="tooltipConfig" :class="slotWrapperClass">
    <!-- Connection Dot -->
    <SlotConnectionDot
      ref="connectionDotRef"
      :color="slotColor"
      class="-translate-x-1/2"
      v-on="readonly ? {} : { pointerdown: onPointerDown }"
    />

    <!-- Slot Name -->
    <span
      v-if="!dotOnly"
      class="whitespace-nowrap text-sm font-normal dark-theme:text-slate-200 text-stone-200"
    >
      {{ slotData.localized_name || slotData.name || `Input ${index}` }}
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  type ComponentPublicInstance,
  type Ref,
  computed,
  inject,
  onErrorCaptured,
  ref,
  watchEffect
} from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { getSlotColor } from '@/constants/slotColors'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { cn } from '@/utils/tailwindUtil'

import SlotConnectionDot from './SlotConnectionDot.vue'

interface InputSlotProps {
  nodeType?: string
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

const tooltipContainer =
  inject<Ref<HTMLElement | undefined>>('tooltipContainer')
const { getInputSlotTooltip, createTooltipConfig } = useNodeTooltips(
  props.nodeType || '',
  tooltipContainer
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

// Get slot color based on type
const slotColor = computed(() => getSlotColor(props.slotData.type))

const slotWrapperClass = computed(() =>
  cn(
    'lg-slot lg-slot--input flex items-center group rounded-r-lg h-6',
    props.readonly ? 'cursor-default opacity-70' : 'cursor-crosshair',
    props.dotOnly
      ? 'lg-slot--dot-only'
      : 'pr-6 hover:bg-black/5 hover:dark:bg-white/5',
    {
      'lg-slot--connected': props.connected,
      'lg-slot--compatible': props.compatible
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
  type: 'input',
  element: slotElRef
})

const { onPointerDown } = useSlotLinkInteraction({
  nodeId: props.nodeId ?? '',
  index: props.index,
  type: 'input',
  readonly: props.readonly
})
</script>
