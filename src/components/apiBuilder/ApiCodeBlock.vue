<script setup lang="ts">
import { default as DOMPurify } from 'dompurify'
import { ref, watchEffect } from 'vue'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import type { HighlightLanguage } from './codeHighlighter'
import { highlightCode } from './codeHighlighter'

const { code, language } = defineProps<{
  code: string
  language: HighlightLanguage
}>()

const colorPaletteStore = useColorPaletteStore()
const html = ref('')

watchEffect(async (onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  const rendered = await highlightCode(
    code,
    language,
    !!colorPaletteStore.completedActivePalette.light_theme
  )
  if (!cancelled) html.value = DOMPurify.sanitize(rendered)
})
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-secondary-background">
    <div
      v-if="html"
      class="[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs/relaxed"
      v-html="html"
    />
    <pre
      v-else
      class="m-0 overflow-x-auto p-4 font-mono text-xs/relaxed"
      v-text="code"
    />
  </div>
</template>
