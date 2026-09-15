<script setup lang="ts">
import { computed } from 'vue'

import type { CodeLang } from '../../lib/highlight'
import { highlightTokens } from '../../lib/highlight'

const { code, language } = defineProps<{
  code: string
  language: CodeLang
}>()

const tokens = computed(() => highlightTokens(code, language))
</script>

<template>
  <code data-testid="highlighted-code">
    <template v-if="tokens">
      <span
        v-for="(token, index) in tokens"
        :key="index"
        :style="{ color: token.color }"
        >{{ token.content }}</span
      >
    </template>
    <template v-else>{{ code }}</template>
  </code>
</template>
