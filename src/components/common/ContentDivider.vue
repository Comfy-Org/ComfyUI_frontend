<template>
  <Divider
    :class="`m-0 [&::before]:border-surface-border/70 [&::before]:border-t-${width}`"
  />
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'

const { width = 1 } = defineProps<{
  width?: number
}>()
</script>
