<template>
  <RadioGroup
    v-model="selectedValue"
    :name="id"
    orientation="horizontal"
    class="flex-row gap-4"
  >
    <div
      v-for="option in normalizedOptions"
      :key="option.value"
      class="flex items-center"
    >
      <RadioGroupItem
        :id="`${id}-${option.value}`"
        :value="String(option.value)"
        :aria-describedby="`${option.text}-label`"
      />
      <label
        :id="`${option.text}-label`"
        :for="`${id}-${option.value}`"
        class="ml-2 cursor-pointer"
      >
        {{ option.text }}
      </label>
    </div>
  </RadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { SettingOption } from '@/platform/settings/types'

type RadioValue = string | number | null

const props = defineProps<{
  modelValue: RadioValue
  options?: (string | SettingOption | Record<string, string>)[]
  optionLabel?: string
  optionValue?: string
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RadioValue]
}>()

const normalizedOptions = computed<SettingOption[]>(() => {
  if (!props.options) return []

  return props.options.map((option) => {
    if (typeof option === 'string') {
      return { text: option, value: option }
    }

    if ('text' in option) {
      return {
        text: option.text,
        value: option.value ?? option.text
      }
    }
    // Handle optionLabel/optionValue
    return {
      text: option[props.optionLabel || 'text'] || 'Unknown',
      value: option[props.optionValue || 'value']
    }
  })
})

const selectedValue = computed({
  get: () => (props.modelValue === null ? undefined : String(props.modelValue)),
  set: (value: string) => {
    const option = normalizedOptions.value.find(
      (option) => String(option.value) === value
    )
    if (option) emit('update:modelValue', option.value ?? option.text)
  }
})
</script>
