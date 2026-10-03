<script setup lang="ts">
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { SnippetLanguage } from '../../config/models-snippets'
import { SNIPPET_LANGUAGES } from '../../config/models-snippets'

const { value, language, label, copiedLabel } = defineProps<{
  value: string
  language: SnippetLanguage
  label: string
  copiedLabel: string
}>()
const emit = defineEmits<{ copied: [language: SnippetLanguage] }>()
</script>

<template>
  <CopyTextButton
    v-for="option in SNIPPET_LANGUAGES"
    v-show="language === option"
    :key="option"
    :value="value"
    :label="label"
    :copied-label="copiedLabel"
    @copied="emit('copied', option)"
  />
</template>
