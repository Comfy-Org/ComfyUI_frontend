<template>
  <template v-for="(part, index) in highlightQuery(text, query)" :key="index">
    <span v-if="part.highlighted" :class="cn('highlight', highlightClass)">{{
      part.text
    }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { highlightQuery } from '@/utils/formatUtil'

const { text, query, highlightClass } = defineProps<{
  query: string
  text: string
  highlightClass?: string
}>()
</script>
