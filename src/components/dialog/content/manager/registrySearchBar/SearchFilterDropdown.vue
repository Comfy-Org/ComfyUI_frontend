<template>
  <div class="flex items-center gap-1">
    <span class="text-muted">{{ label }}:</span>
    <Dropdown
      :model-value="modelValue"
      :options="options"
      option-label="label"
      option-value="id"
      class="min-w-[6rem] border-none bg-transparent shadow-none"
      :pt="{
        input: { class: 'py-0 px-1 border-none' },
        trigger: { class: 'hidden' },
        panel: { class: 'shadow-md' },
        item: { class: 'py-2 px-3 text-sm' }
      }"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts" generic="T">
import Dropdown from 'primevue/dropdown'

import type { SearchOption } from '@/types/comfyManagerTypes'

defineProps<{
  options: SearchOption<T>[]
  label: string
  modelValue: T
}>()

defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>
