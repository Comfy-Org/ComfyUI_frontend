<template>
  <NumberField :id v-model="modelValue" :min :max :step :disabled class="w-32">
    <NumberFieldDecrement />
    <NumberFieldInput :aria-labelledby="ariaLabelledby" />
    <NumberFieldIncrement />
  </NumberField>
</template>

<script setup lang="ts">
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'

defineProps<{
  id?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabelledby?: string
}>()

const modelValue = defineModel<number | null>()
</script>
