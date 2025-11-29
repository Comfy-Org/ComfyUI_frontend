<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WidgetDefinition } from '@/types/node'

interface Props {
  widget: WidgetDefinition<number>
  modelValue: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const localValue = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal
  }
)

const min = computed(() => props.widget.options?.min ?? 0)
const max = computed(() => props.widget.options?.max ?? 100)
const step = computed(() => props.widget.options?.step ?? 1)
const precision = computed(() => props.widget.options?.precision ?? 0)
const disabled = computed(() => props.widget.options?.disabled ?? false)

const percentage = computed(() => {
  const range = max.value - min.value
  if (range === 0) return 0
  return ((localValue.value - min.value) / range) * 100
})

const displayValue = computed(() => {
  return localValue.value.toFixed(precision.value)
})

function handleSliderInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  localValue.value = value
  emit('update:modelValue', value)
}

function handleNumberInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    const clampedValue = Math.min(Math.max(value, min.value), max.value)
    localValue.value = clampedValue
    emit('update:modelValue', clampedValue)
  }
}

function handleNumberBlur(event: Event): void {
  const target = event.target as HTMLInputElement
  target.value = displayValue.value
}
</script>

<template>
  <div class="widget-slider" @pointerdown.stop @mousedown.stop>
    <div class="slider-container">
      <input
        type="range"
        :value="localValue"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="custom-slider nodrag"
        :style="{ '--fill-percent': `${percentage}%` }"
        @input="handleSliderInput"
      />
    </div>
    <input
      type="number"
      :value="displayValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="number-input nodrag"
      @input="handleNumberInput"
      @blur="handleNumberBlur"
    />
  </div>
</template>

<style scoped>
.widget-slider {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.slider-container {
  flex: 1;
  height: 24px;
  display: flex;
  align-items: center;
}

.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: linear-gradient(
    to right,
    #3b82f6 0%,
    #3b82f6 var(--fill-percent),
    #3f3f46 var(--fill-percent),
    #3f3f46 100%
  );
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.custom-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #e4e4e7;
  border: none;
  border-radius: 50%;
  cursor: grab;
  transition: background-color 0.15s, transform 0.15s;
}

.custom-slider::-webkit-slider-thumb:hover {
  background: #fafafa;
  transform: scale(1.1);
}

.custom-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.15);
}

.custom-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #e4e4e7;
  border: none;
  border-radius: 50%;
  cursor: grab;
  transition: background-color 0.15s, transform 0.15s;
}

.custom-slider::-moz-range-thumb:hover {
  background: #fafafa;
  transform: scale(1.1);
}

.custom-slider::-moz-range-thumb:active {
  cursor: grabbing;
}

.custom-slider::-moz-range-track {
  background: transparent;
  border: none;
}

.number-input {
  width: 50px;
  height: 24px;
  background: #2a2a2e;
  border: none;
  border-radius: 4px;
  color: #e4e4e7;
  padding: 0 6px;
  font-size: 11px;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}

.number-input::-webkit-outer-spin-button,
.number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input:focus {
  background: #323238;
}

.number-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
