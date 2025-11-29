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

const min = computed(() => props.widget.options?.min)
const max = computed(() => props.widget.options?.max)
const step = computed(() => props.widget.options?.step ?? 1)
const precision = computed(() => props.widget.options?.precision ?? 0)
const disabled = computed(() => props.widget.options?.disabled ?? false)

const displayValue = computed(() => {
  return localValue.value.toFixed(precision.value)
})

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    let clampedValue = value
    if (min.value !== undefined) clampedValue = Math.max(clampedValue, min.value)
    if (max.value !== undefined) clampedValue = Math.min(clampedValue, max.value)
    localValue.value = clampedValue
    emit('update:modelValue', clampedValue)
  }
}

function handleBlur(event: Event): void {
  const target = event.target as HTMLInputElement
  target.value = displayValue.value
}

function increment(): void {
  let newValue = localValue.value + step.value
  if (max.value !== undefined) newValue = Math.min(newValue, max.value)
  localValue.value = newValue
  emit('update:modelValue', newValue)
}

function decrement(): void {
  let newValue = localValue.value - step.value
  if (min.value !== undefined) newValue = Math.max(newValue, min.value)
  localValue.value = newValue
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div class="widget-number" @pointerdown.stop @mousedown.stop>
    <button
      class="number-btn nodrag"
      :disabled="disabled || (min !== undefined && localValue <= min)"
      @click="decrement"
    >
      <i class="pi pi-minus text-[10px]" />
    </button>
    <input
      type="number"
      :value="displayValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="number-input nodrag"
      @input="handleInput"
      @blur="handleBlur"
    />
    <button
      class="number-btn nodrag"
      :disabled="disabled || (max !== undefined && localValue >= max)"
      @click="increment"
    >
      <i class="pi pi-plus text-[10px]" />
    </button>
  </div>
</template>

<style scoped>
.widget-number {
  display: flex;
  align-items: center;
  gap: 0;
}

.number-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  background: #2a2a2e;
  border: none;
  color: #71717a;
  cursor: pointer;
  transition: all 0.15s;
}

.number-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.number-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.number-btn:hover:not(:disabled) {
  background: #3f3f46;
  color: #a1a1aa;
}

.number-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.number-input {
  flex: 1;
  height: 24px;
  background: #2a2a2e;
  border: none;
  color: #e4e4e7;
  padding: 0 8px;
  font-size: 11px;
  text-align: center;
  outline: none;
  min-width: 0;
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
