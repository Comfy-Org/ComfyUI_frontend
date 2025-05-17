<template>
  <div v-html="renderedHtml" />
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const renderedHtml = computed(() => {
  const rawHtml = marked.parse(props.content) as string
  return DOMPurify.sanitize(rawHtml)
})
</script>

<style scoped>
/* Add any markdown-specific styling here */
</style>
