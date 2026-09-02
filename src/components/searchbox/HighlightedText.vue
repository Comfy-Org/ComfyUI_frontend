<template>
  <template v-for="(part, index) in highlightQuery(text, query)" :key="index">
    <span v-if="part.highlighted" class="highlight">{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup lang="ts">
import { highlightQuery } from '@comfyorg/shared-frontend-utils/formatUtil'

const { text, query } = defineProps<{
  text: string
  query: string
}>()
</script>
