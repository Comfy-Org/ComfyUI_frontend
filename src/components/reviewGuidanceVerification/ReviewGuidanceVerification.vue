<script setup lang="ts">
const { disabled = false, loading = false } = defineProps<{
  disabled?: boolean
  loading?: boolean
}>()
</script>

<template>
  <div :aria-busy="loading" :aria-disabled="disabled" />
</template>

<style scoped>
div {
  color: white;
}
</style>
