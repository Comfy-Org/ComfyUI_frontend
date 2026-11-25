<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from 'reka-ui'
import {
  SliderRange,
  SliderRoot,
  SliderThumb,
  SliderTrack,
  useForwardPropsEmits
} from 'reka-ui'
import { ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  sliderHorizontalTrackClass,
  sliderRootClass,
  sliderThumbClass,
  sliderTrackClass
} from './slider.styles'

const {
  class: rootClass,
  rangeClass,
  thumbClass,
  ariaLabel,
  ...delegatedProps
} = defineProps<
  SliderRootProps & {
    ariaLabel?: HTMLAttributes['aria-label']
    class?: HTMLAttributes['class']
    rangeClass?: HTMLAttributes['class']
    thumbClass?: HTMLAttributes['class']
  }
>()

const pressed = ref(false)
const emits = defineEmits<SliderRootEmits>()
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    :class="
      cn(
        sliderRootClass,
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        rootClass
      )
    "
    v-bind="forwarded"
    @slide-start="pressed = true"
    @slide-move="pressed = true"
    @slide-end="pressed = false"
  >
    <SliderTrack
      data-slot="slider-track"
      :class="
        cn(
          sliderTrackClass,
          'relative grow overflow-hidden',
          'cursor-pointer overflow-visible',
          `before:absolute before:-inset-2 before:block before:bg-transparent`,
          sliderHorizontalTrackClass,
          'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5'
        )
      "
    >
      <SliderRange
        data-slot="slider-range"
        :class="
          cn(
            'absolute bg-foreground data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            rangeClass
          )
        "
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      :aria-label="modelValue?.length === 1 ? ariaLabel : undefined"
      :class="
        cn(
          sliderThumbClass,
          'before:absolute before:-inset-1 before:block before:rounded-full before:bg-transparent',
          { 'cursor-grabbing': pressed },
          thumbClass
        )
      "
    />
  </SliderRoot>
</template>
