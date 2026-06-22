<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  SliderRange,
  SliderRoot,
  SliderThumb,
  SliderTrack,
  useForwardPropsEmits
} from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'

const {
  class: className,
  ticks,
  min = 0,
  max = 100,
  ...restProps
} = defineProps<
  SliderRootProps & { class?: HTMLAttributes['class']; ticks?: number }
>()
const emits = defineEmits<SliderRootEmits>()

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps, min, max })),
  emits
)

function tickValue(i: number): number {
  return min + ((i - 1) / (ticks! - 1)) * (max - min)
}

function isTickFilled(
  i: number,
  modelValue: number[] | null | undefined
): boolean {
  if (!modelValue?.length) return false
  const value = tickValue(i)
  if (modelValue.length === 1) return value <= modelValue[0]
  const sorted = [...modelValue].sort((a, b) => a - b)
  return value >= sorted[0] && value <= sorted[sorted.length - 1]
}
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    :class="
      cn(
        'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className
      )
    "
    v-bind="forwarded"
  >
    <template v-if="ticks && ticks > 1">
      <span
        v-for="i in ticks"
        :key="i"
        data-slot="slider-tick"
        class="pointer-events-none absolute top-1/2 size-2 -translate-1/2 rounded-full"
        :class="
          isTickFilled(i, modelValue)
            ? 'bg-primary-warm-white'
            : 'bg-primary-warm-gray'
        "
        :style="{ left: `${((i - 1) / (ticks - 1)) * 100}%` }"
      />
    </template>

    <SliderTrack
      data-slot="slider-track"
      class="bg-primary-warm-gray relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
    >
      <SliderRange
        data-slot="slider-range"
        class="bg-primary-warm-white absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      class="bg-primary-warm-white border-primary-comfy-yellow ring-primary-comfy-yellow/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
