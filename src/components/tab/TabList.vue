<template>
  <div role="tablist" class="flex w-full items-center gap-2 pb-1">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { provide } from 'vue'

const modelValue = defineModel<string>({ required: true })

// Provide for child Tab components
provide('tabs-value', modelValue)
provide('tabs-update', (value: string) => {
  modelValue.value = value
})
</script>
