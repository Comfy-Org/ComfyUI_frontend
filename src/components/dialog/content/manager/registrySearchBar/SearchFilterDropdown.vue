<template>
  <div class="flex items-center gap-1">
    <span class="text-muted">{{ label }}:</span>
    <Dropdown
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :options="options"
      optionLabel="label"
      optionValue="id"
      class="min-w-[6rem] border-none bg-transparent shadow-none"
      :pt="{
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
