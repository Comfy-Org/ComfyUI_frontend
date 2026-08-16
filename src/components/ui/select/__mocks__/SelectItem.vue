<script setup lang="ts">
defineProps<{
  value: string
}>()
</script>

<template>
  <option :value><slot /></option>
</template>
