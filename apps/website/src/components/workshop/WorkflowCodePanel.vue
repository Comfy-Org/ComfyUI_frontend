<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/ui/badge/Badge.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '@/composables/useTablist'
import type { SnippetLanguage } from '@/config/models-snippets'
import { SNIPPET_LANGUAGES } from '@/config/models-snippets'
import { snippetGraphFold } from '@/config/workshop-workflow-snippet'
import { t } from '@/i18n/translations'
import type { CodeLang } from '@/lib/highlight'
import { highlightLines } from '@/lib/highlight'
import NumberedCode from './NumberedCode.vue'

const { code, nodeCount } = defineProps<{
  code: string
  nodeCount: number
}>()
const language = defineModel<SnippetLanguage>('language', { required: true })
const emit = defineEmits<{ copy: [language: SnippetLanguage] }>()

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

const expanded = ref(false)
const lines = computed(
  () =>
    highlightLines(code, highlightLanguage[language.value]) ??
    code.split('\n').map((line) => [{ content: line }])
)
const fold = computed(() => snippetGraphFold(code.split('\n')))
const restStart = computed(() => {
  if (!fold.value) return lines.value.length
  return expanded.value ? fold.value.start : fold.value.end
})
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink shadow-[inset_0_1px_0_0_var(--color-transparency-white-t8)]"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-transparency-white-t8 bg-transparency-white-t4 px-3 py-2"
    >
      <div
        role="tablist"
        :aria-label="t('workshop.workflow.apiLanguage')"
        class="flex gap-1 rounded-2xl bg-transparency-white-t4 p-1 ring-1 ring-transparency-white-t8 ring-inset"
        @keydown="onLanguageKeydown"
      >
        <button
          v-for="option in SNIPPET_LANGUAGES"
          :id="`workflow-snippet-tab-${option}`"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="language === option"
          aria-controls="workflow-api-snippet"
          :tabindex="language === option ? 0 : -1"
          :class="
            cn(
              'h-7.5 cursor-pointer rounded-xl px-3 text-xs font-bold tracking-wider uppercase transition-colors',
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
    <div
      id="workflow-api-snippet"
      role="tabpanel"
      :aria-labelledby="`workflow-snippet-tab-${language}`"
      tabindex="0"
      class="max-h-96 overflow-y-auto text-sm/relaxed text-primary-warm-white lg:max-h-[min(28rem,calc(100dvh-16rem))]"
      data-testid="workflow-api-snippet"
    >
      <div class="relative overflow-x-auto px-5 pt-5 pb-2">
        <NumberedCode
          :lines="lines.slice(0, fold?.start)"
          :first-line="1"
          :ends-code="!fold"
        />
        <div
          v-if="fold && !expanded"
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-transparent to-primary-comfy-ink"
        />
      </div>
      <template v-if="fold">
        <button
          type="button"
          :aria-expanded="expanded"
          class="flex min-h-11 w-full cursor-pointer items-center gap-3 border-y border-transparency-white-t8 bg-transparency-white-t4 px-5 py-2 text-start text-sm font-medium text-primary-comfy-canvas transition-colors hover:text-primary-warm-white sm:ps-9"
          data-testid="workflow-api-graph-fold"
          @click="expanded = !expanded"
        >
          <ChevronDown
            :class="cn('size-4 transition-transform', expanded && 'rotate-180')"
            aria-hidden="true"
          />
          {{
            expanded
              ? t('workshop.workflow.apiHideGraph')
              : t('workshop.workflow.apiShowGraph')
          }}
          <Badge variant="subtle" class="ms-auto">
            {{
              t(
                'workshop.workflow.apiGraphNodes',
                { count: nodeCount },
                nodeCount
              )
            }}
          </Badge>
        </button>
        <div class="overflow-x-auto px-5 pt-4 pb-5">
          <NumberedCode
            :lines="lines.slice(restStart)"
            :first-line="restStart + 1"
          />
        </div>
      </template>
    </div>
  </div>
</template>
