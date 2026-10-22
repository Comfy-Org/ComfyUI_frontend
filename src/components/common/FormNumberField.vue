<template>
  <NumberField
    :id
    :model-value
    :min
    :max
    :step
    :disabled
    :format-options
    :step-snapping
    :class="className"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <NumberFieldDecrement :aria-label="$t('g.decrement')" />
    <slot name="prefix" />
    <NumberFieldInput :aria-label :aria-labelledby :class="inputClass" />
    <slot name="suffix" />
    <NumberFieldIncrement :aria-label="$t('g.increment')" />
  </NumberField>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import NumberField from '@/components/ui/number-field/NumberField.vue'
import NumberFieldDecrement from '@/components/ui/number-field/NumberFieldDecrement.vue'
import NumberFieldIncrement from '@/components/ui/number-field/NumberFieldIncrement.vue'
import NumberFieldInput from '@/components/ui/number-field/NumberFieldInput.vue'

const { class: className = 'w-32' } = defineProps<{
  class?: HTMLAttributes['class']
  modelValue?: number | null
  id?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabelledby?: string
  ariaLabel?: string
  formatOptions?: Intl.NumberFormatOptions
  stepSnapping?: boolean
  inputClass?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>
