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
import { tHub } from '../../i18n/hub'
import type { CodeLang } from '../../lib/highlight'
import Button from '../ui/button/Button.vue'
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

    <div
      class="flex flex-col gap-3 rounded-2xl border border-transparency-white-t20 p-5"
    >
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span
          class="rounded-md bg-primary-comfy-yellow px-2 py-1 font-mono text-primary-comfy-ink"
        >
          POST
        </span>
        <code class="min-w-0 break-all text-primary-warm-white">
          {{ ownDeployment ? '$COMFY_BASE_URL' : WORKFLOW_API_BASE
          }}{{ WORKFLOW_JOB_PATH }}
        </code>
      </div>
      <p class="text-sm/relaxed text-primary-warm-gray">
        {{
          tHub(
            ownDeployment
              ? 'workshop.v2.api.noteOwn'
              : 'workshop.v2.api.noteCloud',
            locale
          )
        }}
      </p>
      <a
        v-if="ownDeployment"
        href="https://docs.comfy.org/development/serverless/overview"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center text-sm text-primary-comfy-yellow"
      >
        {{ tHub('workshop.v2.api.deployDocs', locale) }} ↗
      </a>
    </div>

    <div class="flex flex-col gap-3 text-sm/relaxed text-primary-warm-gray">
      <p>
        {{ tHub('workshop.v2.api.setup', locale).replace('{file}', file) }}
      </p>
      <code
        class="block overflow-x-auto rounded-xl bg-transparency-white-t8 px-4 py-3 text-primary-warm-white"
      >
        {{ INSTALL[language] }}
      </code>
      <p v-if="inputs.length">
        {{ tHub('workshop.v2.api.localFiles', locale) }}:
        <span
          v-for="(input, index) in inputs"
          :key="`${input.node}.${input.input}`"
        >
          {{ index ? ' · ' : '' }}{{ input.label }}:
          <code class="text-primary-warm-white">{{ input.filename }}</code>
        </span>
      </p>
    </div>

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

    <div class="flex flex-wrap gap-3">
      <Button @click="downloadGraph">
        {{ tHub('workshop.v2.api.downloadGraph', locale) }}
      </Button>
      <Button
        as="a"
        :href="externalLinks.apiKeys"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
      >
        {{ tHub('workshop.v2.api.apiKey', locale) }}
      </Button>
      <Button
        as="a"
        href="https://docs.comfy.org/development/api-development/sdks"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
      >
        {{ tHub('workshop.v2.api.docs', locale) }}
      </Button>
    </div>
  </section>
</template>
