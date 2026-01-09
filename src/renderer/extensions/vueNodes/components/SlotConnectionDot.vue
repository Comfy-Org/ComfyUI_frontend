<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { getSlotColor } from '@/constants/slotColors'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { cn } from '@/utils/tailwindUtil'
import type { ClassValue } from '@/utils/tailwindUtil'

const props = defineProps<{
  slotData?: INodeSlot
  class?: ClassValue
  hasError?: boolean
  multi?: boolean
}>()

const slotElRef = useTemplateRef('slot-el')

function getTypes() {
  if (props.hasError) return ['var(--color-error)']
  //TODO Support connected/disconnected colors?
  if (!props.slotData) return [getSlotColor()]
  const typesSet = new Set(
    `${props.slotData.type}`.split(',').map(getSlotColor)
  )
  return [...typesSet].slice(0, 3)
}
const types = getTypes()

defineExpose({
  slotElRef
})

const slotClass = computed(() =>
  cn(
    'bg-slate-300 rounded-full slot-dot',
    'transition-all duration-150',
    'border border-solid border-node-component-slot-dot-outline',
    props.multi
      ? 'w-3 h-6'
      : 'size-3 cursor-crosshair group-hover/slot:[--node-component-slot-dot-outline-opacity-mult:5] group-hover/slot:scale-125'
  )
)
</script>

<template>
  <div
    :class="
      cn(
        'after:absolute after:inset-y-0 after:w-5/2 relative size-6 flex items-center justify-center group/slot',
        props.class
      )
    "
  >
    <div
      v-if="types.length === 1"
      ref="slot-el"
      :style="{ backgroundColor: types[0] }"
      :class="slotClass"
    />
    <div
      v-else
      ref="slot-el"
      :style="{
        '--type1': types[0],
        '--type2': types[1],
        '--type3': types[2]
      }"
      :class="slotClass"
    >
      <i-comfy:node-slot2
        v-if="types.length === 2"
        class="size-full -translate-y-1/2"
      />
      <i-comfy:node-slot3 v-else class="size-full -translate-y-1/2" />
    </div>
  </div>
</template>
