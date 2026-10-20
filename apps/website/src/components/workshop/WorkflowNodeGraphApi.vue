<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '@/composables/useTablist'
import type { SnippetLanguage } from '@/config/models-snippets'
import { SNIPPET_LANGUAGES } from '@/config/models-snippets'
import { apiKeysLink, externalLinks } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CodeLang } from '@/lib/highlight'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'
import { nodeGraphSnippet } from '@/lib/hub/node-graph-snippets'

import ApiFacts from './ApiFacts.vue'
import HighlightedCode from './HighlightedCode.vue'
import SectionHeading from './SectionHeading.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const language = ref<SnippetLanguage>('python')
const { onKeydown } = useTablist(() => SNIPPET_LANGUAGES, language)
const code = computed(() => nodeGraphSnippet(language.value))
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

const facts = computed(() => [
  {
    label: t('workshop.api.needsEndpoint'),
    value: `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`,
    mono: true,
    copyLabel: t('workshop.api.copyEndpoint')
  },
  {
    label: t('workshop.api.needsKey'),
    value: t('workshop.nodeGraph.api.keyCloud')
  },
  ...(workflow.customNodes.length
    ? [
        {
          label: t('workshop.nodeGraph.api.customNodes'),
          value: workflow.customNodes.join(', ')
        }
      ]
    : [])
])

const stepClass = 'w-full justify-between'
const stepNumberClass =
  'inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-yellow/15 text-xs font-bold'
</script>

<template>
  <section
    class="flex flex-col gap-6"
    aria-labelledby="node-graph-api-heading"
    data-testid="node-graph-api"
  >
    <SectionHeading
      title-id="node-graph-api-heading"
      :title="t('workshop.nodeGraph.api.heading')"
      :subtitle="t('workshop.nodeGraph.api.hint')"
    />
    <div class="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
      <div
        class="flex w-full flex-col gap-3 lg:sticky lg:top-24 lg:w-95 lg:shrink-0"
      >
        <Button
          as="a"
          :href="apiKeysLink({ onboarding: 'models' })"
          target="_blank"
          rel="noopener"
          variant="outline"
          :class="stepClass"
          data-testid="node-graph-api-key"
        >
          <template #prepend>
            <span :class="stepNumberClass" aria-hidden="true">1</span>
          </template>
          {{ t('workshop.api.getKey') }}
          <template #append><span aria-hidden="true">↗</span></template>
        </Button>
        <Button
          as="a"
          :href="workflow.downloadUrl"
          download
          variant="outline"
          :class="stepClass"
        >
          <template #prepend>
            <span :class="stepNumberClass" aria-hidden="true">2</span>
          </template>
          {{ t('workshop.workflow.downloadShort') }}
          <template #append><span aria-hidden="true">↓</span></template>
        </Button>
        <p class="px-1 text-sm/relaxed text-primary-warm-gray">
          {{ t('workshop.nodeGraph.api.export') }}
        </p>
        <ApiFacts
          :where="t('workshop.api.runsOnCloud')"
          :rows="facts"
          :note="
            workflow.customNodes.length
              ? t('workshop.nodeGraph.api.customNodesNote')
              : undefined
          "
          :locale="locale"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <div
          class="overflow-hidden rounded-2xl border border-transparency-white-t20"
        >
          <div
            class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
          >
            <div
              role="tablist"
              :aria-label="t('workshop.nodeGraph.api.heading')"
              class="flex gap-1"
              @keydown="onKeydown"
            >
              <button
                v-for="option in SNIPPET_LANGUAGES"
                :id="`node-graph-snippet-tab-${option}`"
                :key="option"
                type="button"
                role="tab"
                :aria-selected="language === option"
                aria-controls="node-graph-api-snippet"
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
            />
          </div>
          <pre
            id="node-graph-api-snippet"
            role="tabpanel"
            :aria-labelledby="`node-graph-snippet-tab-${language}`"
            tabindex="0"
            class="max-h-168 overflow-auto bg-primary-comfy-ink p-6 text-sm/relaxed text-primary-warm-white"
            data-testid="node-graph-api-snippet"
          ><HighlightedCode :code="code" :language="highlightLanguage[language]" /></pre>
        </div>

        <a
          :href="externalLinks.docsApi"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary-comfy-yellow hover:text-primary-warm-white"
        >
          {{ t('workshop.workflow.apiDocs') }}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>
</template>
