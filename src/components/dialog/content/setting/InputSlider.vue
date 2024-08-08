<template>
  <div class="input-slider">
    <Slider
      :modelValue="modelValue"
      @update:modelValue="updateValue"
      class="slider-part"
      :class="sliderClass"
      v-bind="$attrs"
    />
    <InputText
      :value="modelValue"
      @input="updateValue"
      class="input-part"
      :class="inputClass"
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'

defineProps<{
  modelValue: number
  inputClass?: string
  sliderClass?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const updateValue = (newValue: string | number) => {
  const numValue =
    typeof newValue === 'string' ? parseFloat(newValue) : newValue
  if (!isNaN(numValue)) {
    emit('update:modelValue', numValue)
  }
}
</script>

<style scoped>
.input-slider {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider-part {
  flex-grow: 1;
}

.input-part {
  width: 5rem !important;
}
</style>
