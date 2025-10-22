<template>
  <div class="w-full">
    <div class="flex items-center gap-2 pb-1">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide, toRef } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Provide for child Tab components
provide('tabs-value', toRef(props, 'modelValue'))
provide('tabs-update', (value: string) => emit('update:modelValue', value))
</script>
