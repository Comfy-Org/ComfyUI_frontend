<template>
  <div class="flex items-center gap-1">
    <span class="text-muted">{{ label }}:</span>
    <Dropdown
      v-model="selectedValue"
      :options="options"
      optionLabel="label"
      optionValue="id"
      class="min-w-[6rem]"
      @change="handleChange"
      :pt="{
        root: { class: 'border-none' },
        input: { class: 'py-0 px-1 border-none' },
        trigger: { class: 'hidden' },
        panel: { class: 'shadow-md' },
        item: { class: 'py-2 px-3 text-sm' }
      }"
    />
  </div>
</template>

<script setup lang="ts" generic="T">
import Dropdown from 'primevue/dropdown'
import { computed } from 'vue'

import type { SearchOption } from '@/types/comfyManagerTypes'

const { modelValue, options, label } = defineProps<{
  modelValue: T
  options: SearchOption<T>[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const selectedValue = computed({
  get: () => modelValue,
  set: (value) => emit('update:modelValue', value)
})

const handleChange = () => {
  emit('update:modelValue', selectedValue.value)
}
</script>
