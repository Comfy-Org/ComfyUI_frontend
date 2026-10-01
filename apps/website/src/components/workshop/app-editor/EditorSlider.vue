<script setup lang="ts">
import { computed, useId } from 'vue'

const {
  label,
  min = 0,
  max = 100,
  unit = ''
} = defineProps<{
  label: string
  min?: number
  max?: number
  unit?: string
}>()
const value = defineModel<number>({ required: true })
const id = useId()
const fill = computed(
  () => `${((value.value - min) / (max - min || 1)) * 100}%`
)
</script>

<template>
  <div class="flex h-7 items-center gap-2 px-1">
    <label
      :for="id"
      :title="label"
      class="w-40 shrink-0 truncate text-xs text-primary-warm-gray"
      >{{ label }}</label
    >
    <input
      :id
      v-model.number="value"
      type="range"
      :min
      :max
      :style="{ '--fill': fill }"
      class="h-3 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary-warm-white [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-primary-warm-white)_var(--fill),var(--color-transparency-white-t20)_var(--fill))] [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary-warm-white)_var(--fill),var(--color-transparency-white-t20)_var(--fill))] [&::-webkit-slider-thumb]:-mt-1.25 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-warm-white focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-primary-comfy-yellow/60"
    />
    <span
      class="w-9 shrink-0 text-right text-[11px] text-primary-warm-white tabular-nums"
      >{{ value }}{{ unit }}</span
    >
  </div>
</template>
