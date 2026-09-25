<template>
  <div class="flex flex-row items-center gap-2">
    <Slider
      :model-value="[modelValue]"
      class="w-20"
      :min
      :max
      :step
      :disabled
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
      v-bind="$attrs"
      @update:model-value="
        (value) => value && emit('update:modelValue', value[0])
      "
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
import Slider from '@/components/ui/slider/Slider.vue'
import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'

defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledby?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

defineOptions({
  inheritAttrs: false
})
</script>
