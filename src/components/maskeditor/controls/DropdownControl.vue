<template>
  <div class="relative flex min-h-6 items-center gap-2.5">
    <span class="text-left font-sans text-xs text-muted-foreground">{{
      label
    }}</span>
    <select
      class="absolute right-0 h-6 rounded-md border bg-secondary px-1.5 transition-colors duration-100 focus:outline focus:outline-ring"
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
