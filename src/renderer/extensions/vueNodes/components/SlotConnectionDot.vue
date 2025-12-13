<script setup lang="ts">
import { useTemplateRef } from 'vue'

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

function getStyle() {
  if (props.hasError) return { backgroundColor: 'var(--color-error)' }
  //TODO Support connected/disconnected colors?
  if (!props.slotData) return { backgroundColor: getSlotColor() }
  const typesSet = new Set(
    `${props.slotData.type}`.split(',').map(getSlotColor)
  )
  const types = [...typesSet].slice(0, 3)
  if (types.length === 1) return { backgroundColor: types[0] }
  const angle = 360 / types.length
  const slices = types.map(
    (type, idx) => `${type} ${angle * idx}deg ${angle * (idx + 1)}deg`
  )
  return {
    background: `conic-gradient(${slices.join(',')})`,
    backgroundOrigin: 'border-box'
  }
}
const style = getStyle()

defineExpose({
  slotElRef
})
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
      ref="slot-el"
      class="slot-dot"
      :style
      :class="
        cn(
          'bg-slate-300 rounded-full',
          'transition-all duration-150',
          'border border-solid border-node-component-slot-dot-outline',
          !multi &&
            'cursor-crosshair group-hover/slot:[--node-component-slot-dot-outline-opacity-mult:5] group-hover/slot:scale-125',
          multi ? 'w-3 h-6' : 'size-3'
        )
      "
    />
  </div>
</template>
