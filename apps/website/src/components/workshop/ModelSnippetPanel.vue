<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '@/composables/useTablist'
import type { SnippetLanguage } from '@/config/models-snippets'
import { SNIPPET_LANGUAGES } from '@/config/models-snippets'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CodeLang } from '@/lib/highlight'
import HighlightedCode from './HighlightedCode.vue'

const {
  snippet,
  fileNotice,
  locale = 'en'
} = defineProps<{
  snippet: string
  fileNotice: boolean
  locale?: Locale
}>()
const language = defineModel<SnippetLanguage>('language', { required: true })
const emit = defineEmits<{ copy: [language: SnippetLanguage] }>()
const { t } = translationsFor(locale)

const { onKeydown: onLanguageKeydown } = useTablist(
  () => SNIPPET_LANGUAGES,
  language
)
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
  <div
    class="overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4"
  >
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
          v-for="option in SNIPPET_LANGUAGES"
          :id="`snippet-tab-${option}`"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="language === option"
          aria-controls="snippet-panel"
          :tabindex="language === option ? 0 : -1"
          :data-testid="`snippet-${option}`"
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
        :value="snippet"
        :label="t('workshop.api.copy')"
        :copied-label="t('workshop.api.copied')"
        @click="emit('copy', language)"
      />
    </div>
    <p
      v-if="fileNotice"
      role="note"
      class="px-6 pt-4 text-sm text-primary-warm-gray"
    >
      {{
        t(
          language === 'curl'
            ? 'workshop.api.filesOmitted'
            : 'workshop.api.localFiles'
        )
      }}
    </p>
    <pre
      id="snippet-panel"
      role="tabpanel"
      :aria-labelledby="`snippet-tab-${language}`"
      tabindex="0"
      class="max-h-120 overflow-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
      data-testid="snippet"
    ><HighlightedCode
        :code="snippet"
        :language="highlightLanguage[language]"
      /></pre>
  </div>
</template>
