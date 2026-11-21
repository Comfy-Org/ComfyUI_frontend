<template>
  <div class="flex flex-col gap-3 pb-3">
    <div class="flex items-center justify-between">
      <span class="text-left font-sans text-xs text-muted-foreground">{{
        label
      }}</span>
      <input
        v-if="showInput"
        type="number"
        :aria-label="label"
        class="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="updateValue"
        @change="showModelValue"
      />
    </div>
    <input
      type="range"
      class="maskEditor_sidePanelBrushRange"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="updateValue"
    />
  </div>
</template>

<script setup lang="ts">
import { clamp } from 'es-toolkit'

interface Props {
  label: string
  min: number
  max: number
  step?: number
  showInput?: boolean
}

const { label, min, max, step = 1, showInput = false } = defineProps<Props>()

const modelValue = defineModel<number>({ required: true })

function updateValue(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = event.target.valueAsNumber
  if (Number.isNaN(value)) return
  modelValue.value = clamp(value, min, max)
}

function showModelValue(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    event.target.value = String(modelValue.value)
  }
}
</script>
