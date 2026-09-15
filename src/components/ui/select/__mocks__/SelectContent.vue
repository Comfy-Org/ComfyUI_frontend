<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

const selectModelValue = inject<() => string | undefined>('selectModelValue')
const selectUpdate = inject<(value: string) => void>('selectUpdate')
const element = ref<HTMLSelectElement | null>(null)

onMounted(() => {
  if (element.value) element.value.value = selectModelValue?.() ?? ''
})

const onChange = (event: Event) => {
  if (event.target instanceof HTMLSelectElement) {
    selectUpdate?.(event.target.value)
  }
}
</script>

<template>
  <select ref="element" @change="onChange">
    <slot />
  </select>
</template>
