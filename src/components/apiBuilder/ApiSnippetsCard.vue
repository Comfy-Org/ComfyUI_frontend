<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { cn } from '@comfyorg/tailwind-utils'
import ApiCodeBlock from './ApiCodeBlock.vue'
import type { ApiSpec } from './apiSpec'
import type { SnippetLanguage } from './apiSnippets'
import { SNIPPET_LANGUAGES, buildSnippet } from './apiSnippets'
import type { HighlightLanguage } from './codeHighlighter'

const { spec } = defineProps<{ spec: ApiSpec }>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const LANGUAGE_LABELS: Record<SnippetLanguage, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python'
}

const HIGHLIGHT_LANGUAGES: Record<SnippetLanguage, HighlightLanguage> = {
  curl: 'bash',
  javascript: 'javascript',
  python: 'python'
}

const activeLanguage = ref<SnippetLanguage>(SNIPPET_LANGUAGES[0])
const code = computed(() => buildSnippet(activeLanguage.value, spec))
</script>

<template>
  <section
    class="rounded-2xl border border-border-subtle bg-base-background p-5"
  >
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 min-w-0 flex-1 text-base font-semibold">
        {{ t('apiBuilder.snippetsTitle') }}
      </h2>
      <div
        class="flex items-center gap-1 rounded-lg bg-secondary-background p-1"
        role="tablist"
        :aria-label="t('apiBuilder.snippetsTitle')"
      >
        <Button
          v-for="language in SNIPPET_LANGUAGES"
          :key="language"
          variant="textonly"
          size="sm"
          role="tab"
          :aria-selected="activeLanguage === language"
          :class="
            cn(
              'font-mono',
              activeLanguage === language &&
                'bg-base-background hover:bg-base-background'
            )
          "
          @click="activeLanguage = language"
        >
          {{ LANGUAGE_LABELS[language] }}
        </Button>
      </div>
    </div>
    <div class="relative mt-4">
      <ApiCodeBlock :code :language="HIGHLIGHT_LANGUAGES[activeLanguage]" />
      <Button
        variant="textonly"
        size="icon"
        class="absolute top-2 right-2"
        :aria-label="t('g.copy')"
        @click="copyToClipboard(code)"
      >
        <i class="icon-[lucide--copy]" />
      </Button>
    </div>
  </section>
</template>
