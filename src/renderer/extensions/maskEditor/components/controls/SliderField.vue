<template>
  <div class="flex flex-col gap-2 pb-3">
    <div class="flex items-center gap-2">
      <label
        :id="labelId"
        :for="inputId"
        class="w-0 flex-1 truncate text-left font-sans text-xs text-muted-foreground"
      >
        <SettingHelp v-if="helpText" :text="helpText">{{ label }}</SettingHelp>
        <template v-else>{{ label }}</template>
      </label>
      <div class="flex shrink-0 items-center gap-1">
        <input
          :id="inputId"
          :data-testid="testId"
          :value="modelValue"
          type="number"
          class="w-16 [appearance:textfield] rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
      :model-value="[slider ? slider.value : modelValue]"
      class="flex-1"
      :min="slider ? slider.min : min"
      :max="slider ? slider.max : max"
      :step="slider ? slider.step : step"
      :disabled="disabled"
      :aria-labelledby="labelId"
      @update:model-value="onSliderChange"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, useId } from 'vue'

import Slider from '@comfyorg/design-system/slider/Slider'

import SettingHelp from './SettingHelp.vue'

const {
  disabled = false,
  max,
  min,
  modelValue,
  step = 1,
  suffix,
  helpText,
  slider,
  testId
} = defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  helpText?: string
  testId?: string
  slider?: {
    value: number
    min: number
    max: number
    step: number
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  sliderUpdate: [position: number]
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

async function onCommit(event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = input.valueAsNumber
  if (Number.isFinite(parsed)) {
    commit(parsed)
  }
  await nextTick()
  input.value = String(modelValue)
}

function onSliderChange(value: number[] | undefined) {
  const next = value?.[0]
  if (next === undefined) return
  if (slider) {
    emit('sliderUpdate', next)
    return
  }
  commit(next)
}
</script>
