<template>
  <div class="flex flex-row items-center gap-2">
    <Knob
      :model-value
      :value-template="displayValue"
      class="w-32"
      :min
      :max
      :step
      :disabled
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
      v-bind="$attrs"
      @update:model-value="(value) => emit('update:modelValue', value)"
    />
    <NumberField
      :model-value
      class="w-32"
      :format-options="{ maximumFractionDigits: 3 }"
      :min
      :max
      :step
      :disabled
      @update:model-value="(value) => emit('update:modelValue', value)"
    >
      <NumberFieldDecrement />
      <NumberFieldInput :aria-label :aria-labelledby="ariaLabelledby" />
      <NumberFieldIncrement />
    </NumberField>
  </div>
</template>

<script setup lang="ts">
import Knob from 'primevue/knob'

import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'

const { step, resolution } = defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  resolution?: number
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledby?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const displayValue = (value: number): string => {
  const stepString = (step ?? 1).toString()
  const stepResolution = stepString.includes('.')
    ? stepString.split('.')[1].length
    : 0
  return value.toFixed(resolution ?? stepResolution)
}

defineOptions({
  inheritAttrs: false
})
</script>
