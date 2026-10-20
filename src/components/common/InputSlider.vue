<template>
  <div class="flex items-center gap-2">
    <Slider
      :model-value="[modelValue]"
      class="w-20"
      :min
      :max
      :step
      :disabled
      :aria-label
      :aria-labelledby
      v-bind="$attrs"
      @update:model-value="
        (value) => value && emit('update:modelValue', value[0])
      "
    />
    <FormNumberField
      :model-value
      class="w-32"
      :format-options="{ maximumFractionDigits: 3 }"
      :min
      :max
      :step
      step-snapping
      :disabled
      :aria-label
      :aria-labelledby
      @update:model-value="(value) => emit('update:modelValue', value)"
    />
  </div>
</template>

<script setup lang="ts">
import Slider from '@/components/ui/slider/Slider.vue'
import FormNumberField from '@/components/common/FormNumberField.vue'

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
