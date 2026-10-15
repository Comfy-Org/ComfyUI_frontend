<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '@/composables/useTablist'
import type { SnippetLanguage } from '@/config/models-snippets'
import { SNIPPET_LANGUAGES } from '@/config/models-snippets'
import { snippetGraphFold } from '@/config/workshop-workflow-snippet'
import { t } from '@/i18n/translations'
import type { CodeLang, HighlightToken } from '@/lib/highlight'
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
const lines = computed<readonly (readonly HighlightToken[])[]>(
  () =>
    highlightLines(code, highlightLanguage[language.value]) ??
    code.split('\n').map((line) => [{ content: line }])
)
const lineBreak = '\n'

const fold = computed(() => {
  const graph = snippetGraphFold(code.split('\n'), 0)
  return graph && { opening: graph.start - 1, closing: graph.end }
})
const afterFold = computed(() => {
  if (!fold.value) return []
  return lines.value.slice(
    expanded.value ? fold.value.opening + 1 : fold.value.closing + 1
  )
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
      <div class="overflow-x-auto p-5">
        <NumberedCode v-if="!fold" :lines="lines" :first-line="1" />
        <template v-else>
          <NumberedCode
            :lines="lines.slice(0, fold.opening)"
            :first-line="1"
            :ends-code="false"
          />
          <code
            class="block w-max min-w-full font-mono whitespace-pre"
            :style="{ counterReset: `line ${fold.opening}` }"
          >
            <span
              class="block [counter-increment:line] before:me-4 before:inline-block before:w-8 before:text-end before:text-primary-warm-gray/70 before:content-[counter(line)] before:select-none"
              ><span
                v-for="(token, index) in lines[fold.opening]"
                :key="index"
                :style="{ color: token.color }"
                >{{ token.content }}</span
              ><button
                type="button"
                :aria-expanded="expanded"
                class="mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-primary-comfy-yellow/50 bg-primary-comfy-yellow/15 px-2 align-middle font-mono text-xs/5 text-primary-comfy-yellow transition-colors hover:bg-primary-comfy-yellow/25 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
                data-testid="workflow-api-graph-fold"
                @click="expanded = !expanded"
              >
                <ChevronRight
                  :class="
                    cn('size-3.5 transition-transform', expanded && 'rotate-90')
                  "
                  aria-hidden="true"
                />
                {{
                  t(
                    'workshop.workflow.apiGraphNodes',
                    { count: nodeCount },
                    nodeCount
                  )
                }}
                <span aria-hidden="true">·</span>
                {{
                  expanded
                    ? t('workshop.workflow.apiHideGraph')
                    : t('workshop.workflow.apiShowGraph')
                }}</button
              ><template v-if="!expanded"
                ><span
                  v-for="(token, index) in lines[fold.closing]"
                  :key="index"
                  :style="{ color: token.color }"
                  >{{ token.content }}</span
                ></template
              >{{ lineBreak }}</span
            >
          </code>
          <NumberedCode :lines="afterFold" :first-line="fold.opening + 2" />
        </template>
      </div>
    </div>
  </div>
</template>
