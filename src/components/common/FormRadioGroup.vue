<template>
  <div class="flex flex-row gap-4">
    <div
      v-for="option in normalizedOptions"
      :key="option.value"
      class="flex items-center"
    >
      <RadioButton
        :input-id="`${id}-${option.value}`"
        :name="id"
        :value="option.value"
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
      />
      <label :for="`${id}-${option.value}`" class="ml-2 cursor-pointer">
        {{ option.text }}
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import RadioButton from 'primevue/radiobutton'
import { computed } from 'vue'

const props = defineProps<{
  modelValue: any
  options: any[] | undefined
  optionLabel?: string
  optionValue?: string
  id?: string
}>()

defineEmits<{
  'update:modelValue': [value: any]
}>()

const normalizedOptions = computed(() => {
  if (!props.options) return []

  return props.options.map((option) => {
    if (typeof option === 'string') {
      return { text: option, value: option }
    }
    return {
      text: option[props.optionLabel || 'text'],
      value: option[props.optionValue || 'value']
    }
  })
})
</script>
