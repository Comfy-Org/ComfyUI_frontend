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
  modelValue,
  thumbLabel,
  thumbValueText,
  ...restProps
} = defineProps<
  SliderRootProps & {
    class?: HTMLAttributes['class']
    ticks?: number
    /** Accessible name/value for the thumb; reka only exposes the numeric index. */
    thumbLabel?: string
    thumbValueText?: string
  }
>()
const emits = defineEmits<SliderRootEmits>()

const forwarded = useForwardPropsEmits(
  computed(() => ({ ...restProps, modelValue, min, max })),
  emits
)

// Single source of truth for tick geometry, shared by the on-track dots and the
// optional #tick label slot so the two can never drift apart.
function tickLeft(i: number): string {
  return `calc(8px + ${(i - 1) / (ticks! - 1)} * (100% - 16px))`
}

function tickValue(i: number): number {
  return min + ((i - 1) / (ticks! - 1)) * (max - min)
}

function isTickActive(i: number): boolean {
  const value = modelValue?.[0]
  if (value == null || ticks == null || ticks <= 1) return false
  // Map the current value to its nearest tick index and compare as integers,
  // avoiding floating-point equality on the divide-then-multiply tick value
  // (e.g. for 7 ticks, tickValue(2) === 0.9999999999999999, not 1).
  const activeIndex =
    max === min ? 0 : Math.round(((value - min) / (max - min)) * (ticks - 1))
  return i - 1 === activeIndex
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
        'relative flex w-full touch-none items-center select-none data-disabled:opacity-50',
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
        :style="{ left: tickLeft(i) }"
      />
    </template>

    <SliderTrack
      data-slot="slider-track"
      class="bg-primary-warm-gray relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full"
    >
      <SliderRange
        data-slot="slider-range"
        class="bg-primary-warm-white absolute data-[orientation=horizontal]:h-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      :aria-label="thumbLabel"
      :aria-valuetext="thumbValueText"
      class="bg-primary-warm-white border-primary-comfy-yellow ring-primary-comfy-yellow/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>

  <div v-if="$slots.tick && ticks && ticks > 1" class="relative mt-3 h-6">
    <div
      v-for="i in ticks"
      :key="i"
      class="absolute top-0 inline-flex -translate-x-1/2 items-center gap-1.5"
      :style="{ left: tickLeft(i) }"
    >
      <slot name="tick" :index="i - 1" :active="isTickActive(i)" />
    </div>
  </div>
</template>
