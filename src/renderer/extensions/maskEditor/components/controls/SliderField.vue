<template>
  <div class="flex flex-col gap-2 pb-3">
    <div class="flex items-center justify-between gap-2">
      <label
        :id="labelId"
        :for="inputId"
        class="text-left font-sans text-xs text-muted-foreground"
      >
        {{ label }}
      </label>
      <div class="flex items-center gap-1">
        <input
          :id="inputId"
          :value="modelValue"
          type="number"
          class="w-16 [appearance:textfield] rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          @input="onInput"
          @change="onCommit"
        />
        <span
          v-if="suffix"
          class="text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {{ suffix }}
        </span>
      </div>
    </div>
    <Slider
      :model-value="[modelValue]"
      class="flex-1"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-labelledby="labelId"
      @update:model-value="onSliderChange"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'

const {
  disabled = false,
  max,
  min,
  modelValue,
  step = 1,
  suffix
} = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputId = useId()
const labelId = useId()

function clamp(value: number): number {
  return Math.min(max, Math.max(min, value))
}

function commit(value: number) {
  if (!Number.isFinite(value)) return
  emit('update:modelValue', clamp(value))
}

function onInput(event: Event) {
  commit((event.target as HTMLInputElement).valueAsNumber)
}

function onCommit(event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = input.valueAsNumber
  if (!Number.isFinite(parsed)) {
    input.value = String(modelValue)
    return
  }
  commit(parsed)
}

function onSliderChange(value: number[] | undefined) {
  const next = value?.[0]
  if (next === undefined) return
  commit(next)
}
</script>
