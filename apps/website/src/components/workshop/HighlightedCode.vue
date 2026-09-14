<script setup lang="ts">
import { shallowRef, watch } from 'vue'

import type { CodeLang, HighlightToken } from '../../lib/highlight'
import { highlightTokens } from '../../lib/highlight'

const { code, language } = defineProps<{
  code: string
  language: CodeLang
}>()

const tokens = shallowRef<readonly HighlightToken[] | null>(null)

watch(
  () => [code, language] as const,
  async ([nextCode, nextLanguage], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    tokens.value = null
    const nextTokens = await highlightTokens(nextCode, nextLanguage)
    if (active) tokens.value = nextTokens
  },
  { immediate: !import.meta.env.SSR }
)
</script>

<template>
  <code>
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
