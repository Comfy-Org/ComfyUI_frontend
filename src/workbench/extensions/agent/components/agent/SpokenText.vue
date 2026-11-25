<script setup lang="ts">
import { computed } from 'vue'

import {
  WORD_STAGGER_MS,
  splitWords
} from '@/workbench/extensions/agent/utils/speechTiming'

const { text, startMs } = defineProps<{
  text: string
  startMs: number
}>()

const words = computed(() => splitWords(text))
</script>

<template>
  <template v-for="(word, index) in words" :key="index">
    <span
      class="agent-talk-word"
      :style="{ '--talk-delay': `${startMs + index * WORD_STAGGER_MS}ms` }"
      >{{ word }}</span
    >{{ index < words.length - 1 ? ' ' : '' }}
  </template>
</template>
