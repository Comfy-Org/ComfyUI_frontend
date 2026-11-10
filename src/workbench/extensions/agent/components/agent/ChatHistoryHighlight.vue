<script setup lang="ts">
import type { HighlightPart } from '@/workbench/extensions/agent/utils/chatHistoryRowText'

defineProps<{ parts: readonly HighlightPart[] }>()
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <!-- Bold + background, the repo's search-highlight style: not colour alone. -->
    <mark
      v-if="part.highlighted"
      class="rounded-sm bg-primary px-0.5 font-bold text-foreground"
      >{{ part.text }}</mark
    >
    <template v-else>{{ part.text }}</template>
  </template>
</template>
