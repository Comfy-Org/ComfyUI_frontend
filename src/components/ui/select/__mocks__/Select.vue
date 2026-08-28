<script setup lang="ts">
import { provide } from 'vue'

const modelValue = defineModel<string>()

provide('selectModelValue', () => modelValue.value)
provide('selectUpdate', (value: string) => {
  modelValue.value = value
})
</script>

<template>
  <div><slot /></div>
</template>
