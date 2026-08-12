<script setup lang="ts">
const { modelValue, min, max, step } = defineProps<{
  modelValue: number | number[]
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const onInput = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    emit('update:modelValue', [Number(event.target.value)])
  }
}
</script>

<template>
  <input
    type="range"
    role="slider"
    :value="Array.isArray(modelValue) ? modelValue[0] : modelValue"
    :min
    :max
    :step
    @input="onInput"
  />
</template>
