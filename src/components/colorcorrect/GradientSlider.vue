<script setup lang="ts">
import { SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, ref } from 'vue'

import type { ColorStop } from '@/components/colorcorrect/gradients'
import {
  interpolateStops,
  stopsToGradient
} from '@/components/colorcorrect/gradients'
import { cn } from '@/utils/tailwindUtil'

const {
  stops,
  min = 0,
  max = 100,
  step = 1,
  disabled = false
} = defineProps<{
  stops: ColorStop[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>()

const modelValue = defineModel<number>({ required: true })

const sliderValue = computed({
  get: () => [modelValue.value],
  set: (v: number[]) => {
    if (v.length) modelValue.value = v[0]
  }
})

const gradient = computed(() => stopsToGradient(stops))

const thumbColor = computed(() => {
  const t = max === min ? 0 : (modelValue.value - min) / (max - min)
  return interpolateStops(stops, t)
})

const pressed = ref(false)
</script>

<template>
  <SliderRoot
    v-model="sliderValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :class="
      cn(
        'relative flex w-full touch-none items-center select-none',
        'data-[disabled]:opacity-50'
      )
    "
    :style="{ '--reka-slider-thumb-transform': 'translate(-50%, -50%)' }"
    @slide-start="pressed = true"
    @slide-move="pressed = true"
    @slide-end="pressed = false"
  >
    <SliderTrack
      :class="
        cn(
          'relative h-2.5 w-full grow cursor-pointer overflow-visible rounded-full',
          'before:absolute before:-inset-2 before:block before:bg-transparent'
        )
      "
      :style="{ background: gradient }"
    >
      <SliderThumb
        :class="
          cn(
            'block size-4 shrink-0 cursor-grab rounded-full shadow-md ring-1 ring-black/25',
            'transition-[color,box-shadow,background-color]',
            'before:absolute before:-inset-1.5 before:block before:rounded-full before:bg-transparent',
            'hover:ring-2 hover:ring-black/40 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-hidden',
            'disabled:pointer-events-none disabled:opacity-50',
            { 'cursor-grabbing': pressed }
          )
        "
        :style="{ backgroundColor: thumbColor, top: '50%' }"
      />
    </SliderTrack>
  </SliderRoot>
</template>
