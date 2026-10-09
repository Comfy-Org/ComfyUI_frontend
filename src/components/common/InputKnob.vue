<template>
  <div class="flex items-center gap-2">
    <Knob
      v-model="modelValue"
      :min
      :max
      :step
      :disabled
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabelledby"
      v-bind="$attrs"
    />
    <NumberField
      v-model="modelValue"
      class="w-32"
      :format-options="{ maximumFractionDigits: 3 }"
      :min
      :max
      :step
      step-snapping
      :disabled
    >
      <NumberFieldDecrement />
      <NumberFieldInput :aria-label :aria-labelledby="ariaLabelledby" />
      <NumberFieldIncrement />
    </NumberField>
  </div>
</template>

<script setup lang="ts">
import Knob from '@/components/ui/knob/Knob.vue'
import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'

defineProps<{
  ariaLabel?: string
  ariaLabelledby?: string
  disabled?: boolean
  max?: number
  min?: number
  step?: number
}>()

const modelValue = defineModel<number>({ required: true })

defineOptions({
  inheritAttrs: false
})
</script>
