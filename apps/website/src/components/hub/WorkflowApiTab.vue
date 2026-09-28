<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '../../composables/useTablist'
import type { SnippetLanguage } from '../../config/models-snippets'
import { SNIPPET_LANGUAGES } from '../../config/models-snippets'
import { externalLinks } from '../../config/routes'
import type { WorkflowGraph } from '../../config/workflow-execution'
import type { WorkflowField } from '../../config/workflow-fields'
import {
  WORKFLOW_API_BASE,
  WORKFLOW_JOB_PATH,
  buildWorkflowSnippet,
  workflowInputs
} from '../../config/workflow-snippets'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { CodeLang } from '../../lib/highlight'
import Button from '../ui/button/Button.vue'
import ApiFacts from '../workshop/ApiFacts.vue'
import HighlightedCode from '../workshop/HighlightedCode.vue'

// What a developer runs to call this workflow themselves. A workflow with a
// server of its own reads its address from the environment, so the snippet is
// what they would run against their deployment rather than our address.
const {
  fields,
  graph,
  slug,
  ownDeployment = false,
  values = {},
  locale = 'en'
} = defineProps<{
  fields: readonly WorkflowField[]
  graph: WorkflowGraph
  slug: string
  ownDeployment?: boolean
  values?: Readonly<Record<string, string | number>>
  locale?: Locale
}>()

const language = ref<SnippetLanguage>('python')
const { onKeydown } = useTablist(() => SNIPPET_LANGUAGES, language)

const workflow = computed(() => ({ fields, slug, ownDeployment }))
const snippet = computed(() =>
  buildWorkflowSnippet(language.value, workflow.value, graph, values)
)
const inputs = computed(() =>
  workflowInputs(workflow.value, graph, values).filter(
    (input) => input.filename
  )
)
const file = computed(() => `${slug}.api.json`)

const facts = computed(() => [
  {
    label: t('workshop.api.needsEndpoint', locale),
    value: `POST ${ownDeployment ? '$COMFY_BASE_URL' : WORKFLOW_API_BASE}${WORKFLOW_JOB_PATH}`,
    mono: true
  },
  {
    label: t('workshop.api.needsKey', locale),
    value: 'COMFY_API_KEY',
    mono: true
  },
  ...(ownDeployment
    ? []
    : [
        {
          label: t('workshop.api.needsPlan', locale),
          value: tHub('workshop.v2.api.noteCloud', locale)
        }
      ]),
  {
    label: t('workshop.api.needsGraph', locale),
    value: file.value,
    mono: true
  },
  ...(inputs.value.length
    ? [
        {
          label: t('workshop.api.needsFiles', locale),
          value: inputs.value
            .map((input) => `${input.label}: ${input.filename}`)
            .join(' · ')
        }
      ]
    : [])
])

const LANGUAGE_NAMES: Record<SnippetLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
  curl: 'cURL'
}
const HIGHLIGHT: Record<SnippetLanguage, CodeLang> = {
  python: 'python',
  typescript: 'typescript',
  curl: 'shell'
}
const INSTALL: Record<SnippetLanguage, string> = {
  python: 'pip install comfy-sdk',
  typescript: 'npm install @comfyorg/sdk',
  curl: 'Requires bash, curl, jq and uuidgen.'
}

function downloadGraph() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.value
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-6"
    data-testid="workflow-api"
    :aria-label="tHub('workshop.v2.api.title', locale)"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-2xl font-bold text-primary-comfy-canvas">
        {{ tHub('workshop.v2.api.title', locale) }}
      </h2>
      <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
        {{
          tHub(
            ownDeployment
              ? 'workshop.v2.api.leadOwn'
              : 'workshop.v2.api.leadCloud',
            locale
          )
        }}
      </p>
    </div>

    <div class="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
      <aside
        class="flex w-full flex-col gap-3 lg:sticky lg:top-24 lg:w-95 lg:shrink-0"
      >
        <Button
          v-if="ownDeployment"
          as="a"
          href="https://docs.comfy.org/development/serverless/overview"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full justify-between"
        >
          <template #prepend>
            <span
              class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-ink/15 text-xs font-bold"
            >
              1
            </span>
          </template>
          {{ tHub('workshop.v2.api.deployDocs', locale) }}
          <template #append><span aria-hidden="true">↗</span></template>
        </Button>
        <Button
          as="a"
          :href="externalLinks.apiKeys"
          target="_blank"
          rel="noopener noreferrer"
          :variant="ownDeployment ? 'outline' : undefined"
          class="w-full justify-between"
        >
          <template #prepend>
            <span
              :class="
                cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-xs font-bold',
                  ownDeployment
                    ? 'bg-primary-comfy-yellow/15'
                    : 'bg-primary-comfy-ink/15'
                )
              "
            >
              {{ ownDeployment ? 2 : 1 }}
            </span>
          </template>
          {{ tHub('workshop.v2.api.apiKey', locale) }}
          <template #append><span aria-hidden="true">↗</span></template>
        </Button>
        <Button
          variant="outline"
          class="w-full justify-between"
          @click="downloadGraph"
        >
          <template #prepend>
            <span
              class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-yellow/15 text-xs font-bold"
            >
              {{ ownDeployment ? 3 : 2 }}
            </span>
          </template>
          {{ tHub('workshop.v2.api.downloadGraph', locale) }}
          <template #append><span aria-hidden="true">&nbsp;</span></template>
        </Button>

        <ApiFacts
          :where="
            t(
              ownDeployment
                ? 'workshop.api.runsOnOwn'
                : 'workshop.api.runsOnCloud',
              locale
            )
          "
          :rows="facts"
          :locale="locale"
        />
      </aside>

      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <code
          class="block overflow-x-auto rounded-xl bg-transparency-white-t8 px-4 py-3 text-sm text-primary-warm-white"
        >
          {{ INSTALL[language] }}
        </code>

        <div
          class="overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4"
        >
          <div
            class="flex items-center justify-between border-b border-transparency-white-t8 px-3 py-2"
          >
            <div
              role="tablist"
              :aria-label="tHub('workshop.v2.api.language', locale)"
              class="flex gap-1"
              @keydown="onKeydown"
            >
              <button
                v-for="option in SNIPPET_LANGUAGES"
                :id="`workflow-snippet-${option}`"
                :key="option"
                type="button"
                role="tab"
                :aria-selected="language === option"
                aria-controls="workflow-snippet-panel"
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
                {{ LANGUAGE_NAMES[option] }}
              </button>
            </div>
            <CopyTextButton
              :value="snippet"
              :label="tHub('workshop.v2.api.copy', locale)"
              :copied-label="tHub('workshop.v2.api.copied', locale)"
            />
          </div>
          <pre
            id="workflow-snippet-panel"
            role="tabpanel"
            :aria-labelledby="`workflow-snippet-${language}`"
            tabindex="0"
            class="max-h-160 overflow-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
            data-testid="workflow-snippet"
          ><HighlightedCode :code="snippet" :language="HIGHLIGHT[language]" /></pre>
        </div>

        <p
          v-if="language === 'curl'"
          class="text-sm/relaxed text-primary-warm-gray"
        >
          {{ tHub('workshop.v2.api.curlNote', locale) }}
        </p>

        <a
          href="https://docs.comfy.org/development/api-development/sdks"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary-comfy-yellow hover:text-primary-warm-white"
        >
          {{ tHub('workshop.v2.api.docs', locale) }}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>
</template>
