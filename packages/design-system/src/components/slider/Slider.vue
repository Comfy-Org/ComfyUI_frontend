<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { SliderRootEmits, SliderRootProps } from 'reka-ui'
import {
  SliderRange,
  SliderRoot,
  SliderThumb,
  useForwardPropsEmits
} from 'reka-ui'
import { ref } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<
  SliderRootProps & {
    class?: HTMLAttributes['class']
    rangeClass?: HTMLAttributes['class']
    thumbClass?: HTMLAttributes['class']
  }
>()

const pressed = ref(false)
const setPressed = (val: boolean) => {
  pressed.value = val
}

const emits = defineEmits<SliderRootEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'rangeClass', 'thumbClass')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    :class="
      cn(
        'relative flex w-full cursor-pointer touch-none items-center select-none data-disabled:opacity-50',
        'before:absolute before:rounded-full before:bg-muted-foreground/20 data-[orientation=horizontal]:before:inset-x-0 data-[orientation=horizontal]:before:h-0.5 data-[orientation=vertical]:before:inset-y-0 data-[orientation=vertical]:before:w-0.5',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        props.class
      )
    "
    v-bind="forwarded"
    @slide-start="() => setPressed(true)"
    @slide-move="() => setPressed(true)"
    @slide-end="() => setPressed(false)"
  >
    <SliderRange
      data-slot="slider-range"
      :class="
        cn(
          'absolute bg-foreground data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5',
          props.rangeClass
        )
      "
    />

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      :class="
        cn(
          'block size-3.5 shrink-0 rounded-full bg-foreground shadow-sm ring-foreground transition-[color,box-shadow]',
          'cursor-grab',
          'before:absolute before:-inset-1 before:block before:rounded-full before:bg-transparent',
          'hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
          { 'cursor-grabbing': pressed },
          props.thumbClass
        )
      "
    />
  </SliderRoot>
</template>
