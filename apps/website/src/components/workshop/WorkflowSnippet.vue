<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '@/composables/useTablist'
import type { SnippetLanguage } from '@/config/models-snippets'
import { translationsFor } from '@/i18n/translations'
import type { CodeLang } from '@/lib/highlight'
import HighlightedCode from './HighlightedCode.vue'
const { code, languages, locale } = defineProps<{
  code: string
  languages: readonly SnippetLanguage[]
  locale: Locale
}>()
const language = defineModel<SnippetLanguage>({ required: true })
const emit = defineEmits<{ copy: [language: SnippetLanguage] }>()
const t = computed(() => translationsFor(locale).t)
const { onKeydown: onLanguageKeydown } = useTablist(() => languages, language)
const languageLabel: Record<SnippetLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
  curl: 'cURL'
}
const highlightLanguage = {
  python: 'python',
  typescript: 'typescript',
  curl: 'shell'
} satisfies Record<SnippetLanguage, CodeLang>
</script>
<template>
  <div class="overflow-hidden rounded-2xl border border-transparency-white-t20">
    <div
      class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
    >
      <div
        role="tablist"
        :aria-label="t('workshop.api.heading')"
        class="flex gap-1"
        @keydown="onLanguageKeydown"
      >
        <button
          v-for="option in languages"
          :id="`workflow-snippet-tab-${option}`"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="language === option"
          aria-controls="workflow-api-snippet"
          :tabindex="language === option ? 0 : -1"
          :class="
            cn(
              'cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors',
              language === option
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'text-primary-comfy-canvas hover:bg-transparency-white-t8 hover:text-primary-warm-white'
            )
          "
          @click="language = option"
        >
          {{ languageLabel[option] }}
        </button>
      </div>
      <CopyTextButton
        :value="code"
        :label="t('workshop.api.copy')"
        :copied-label="t('workshop.api.copied')"
        @click="emit('copy', language)"
      />
    </div>
    <pre
      id="workflow-api-snippet"
      role="tabpanel"
      :aria-labelledby="`workflow-snippet-tab-${language}`"
      tabindex="0"
      class="max-h-168 overflow-auto bg-primary-comfy-ink p-6 text-sm/relaxed text-primary-warm-white"
      data-testid="workflow-api-snippet"
    ><HighlightedCode :code="code" :language="highlightLanguage[language]" /></pre>
  </div>
</template>
