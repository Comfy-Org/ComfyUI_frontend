<script setup lang="ts">
import { computed } from 'vue'

import { WORD_STAGGER_MS, talkTokens } from './speechTiming'

const {
  text,
  startMs,
  staggerMs = WORD_STAGGER_MS
} = defineProps<{
  text: string
  startMs: number
  staggerMs?: number
}>()

const tokens = computed(() => talkTokens(text, startMs, staggerMs))
</script>

<template>
  <template v-for="(token, index) in tokens" :key="index">
    <span
      v-if="token.delayMs !== undefined"
      class="agent-talk-word"
      :style="{ '--talk-delay': `${token.delayMs}ms` }"
      >{{ token.text }}</span
    >
    <template v-else>{{ token.text }}</template>
  </template>
</template>
