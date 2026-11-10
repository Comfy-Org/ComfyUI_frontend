<script setup lang="ts">
import type { HighlightPart } from '@/workbench/extensions/agent/utils/chatHistoryRowText'

defineProps<{ parts: readonly HighlightPart[] }>()
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <mark
      v-if="part.highlighted"
      class="rounded-sm bg-primary/30 text-foreground"
      >{{ part.text }}</mark
    >
    <template v-else>{{ part.text }}</template>
  </template>
</template>
