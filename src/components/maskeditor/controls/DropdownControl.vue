<template>
  <div class="flex flex-row gap-2.5 items-center min-h-6 relative">
    <span class="text-left text-xs font-sans text-[var(--descrip-text)]">{{
      label
    }}</span>
    <select
      class="absolute right-0 h-6 px-1.5 rounded-md border border-[var(--p-form-field-border-color)] transition-colors duration-100 bg-[var(--comfy-menu-bg)] focus:outline focus:outline-1 focus:outline-[var(--p-surface-300)] dark-theme:bg-[var(--p-surface-900)] dark-theme:focus:outline-[var(--p-button-text-primary-color)]"
      :value="modelValue"
      @change="onChange"
    >
      <option
        v-for="option in normalizedOptions"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface DropdownOption {
  label: string
  value: string | number
}

interface Props {
  label: string
  options: string[] | DropdownOption[]
  modelValue: string | number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const normalizedOptions = computed((): DropdownOption[] => {
  return props.options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option }
    }
    return option
  })
})

const onChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value)
}
</script>
