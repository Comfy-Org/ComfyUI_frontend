<template>
  <div class="flex items-center gap-2">
    <Knob
      v-model="modelValue"
      :min
      :max
      :step
      :disabled
      :aria-label
      :aria-labelledby
      v-bind="$attrs"
    />
    <FormNumberField
      v-model="modelValue"
      class="w-32"
      :format-options="{ maximumFractionDigits: 3 }"
      :min
      :max
      :step
      :step-snapping="step !== 0"
      :disabled
      :aria-label
      :aria-labelledby
    />
  </div>
</template>

<script setup lang="ts">
import Knob from '@/components/ui/knob/Knob.vue'
import FormNumberField from '@/components/common/FormNumberField.vue'

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
