<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <label
        :for="inputId"
        class="text-left font-sans text-xs text-(--descrip-text)"
      >
        {{ label }}
      </label>
      <div class="relative">
        <input
          :id="inputId"
          :value="modelValue"
          type="number"
          class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
          :min="min"
          :max="max"
          :step="step"
          @input="onInput"
          @change="onChange"
        />
        <span
          v-if="suffix"
          class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
        >
          {{ suffix }}
        </span>
      </div>
    </div>
    <Slider
      :id="`${inputId}-slider`"
      :model-value="[modelValue]"
      :aria-labelledby="inputId"
      class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="onSliderChange"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import Slider from '@/components/ui/slider/Slider.vue'

interface Props {
  label: string
  modelValue: number
  min: number
  max: number
  step: number
  suffix?: string
  inputId?: string
}

const props = withDefaults(defineProps<Props>(), {
  suffix: undefined,
  inputId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const generatedId = useId()
const inputId = props.inputId ?? generatedId

function clamp(value: number): number {
  return Math.min(props.max, Math.max(props.min, value))
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const parsed = Number(target.value)
  if (Number.isNaN(parsed)) return
  emit('update:modelValue', clamp(parsed))
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const parsed = Number(target.value)
  if (Number.isNaN(parsed)) return
  emit('update:modelValue', clamp(parsed))
}

function onSliderChange(value: number[] | undefined) {
  if (!value?.length) return
  const parsed = Number(value[0])
  if (Number.isNaN(parsed)) return
  emit('update:modelValue', clamp(parsed))
}
</script>
