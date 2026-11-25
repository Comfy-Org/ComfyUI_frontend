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
        'relative flex w-full touch-none items-center select-none data-disabled:opacity-50',
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
          'relative grow overflow-hidden rounded-full bg-muted-foreground/20',
          'cursor-pointer overflow-visible',
          `before:absolute before:-inset-2 before:block before:bg-transparent`,
          'data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full',
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
          'block size-3.5 shrink-0 rounded-full bg-foreground shadow-sm ring-foreground transition-[color,box-shadow]',
          'cursor-grab',
          'before:absolute before:-inset-1 before:block before:rounded-full before:bg-transparent',
          'hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
          { 'cursor-grabbing': pressed },
          thumbClass
        )
      "
    />
  </SliderRoot>
</template>
