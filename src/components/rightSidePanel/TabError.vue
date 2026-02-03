<script setup lang="ts">
import type { NodeError } from '@/schemas/apiSchema'
defineProps<{
  errors: NodeError[]
}>()
</script>
<template>
  <div v-for="(error, index) in errors.flatMap((ne) => ne.errors)" :key="index">
    <h3 v-text="error.message" />
    <div v-text="error.details" />
  </div>
</template>
