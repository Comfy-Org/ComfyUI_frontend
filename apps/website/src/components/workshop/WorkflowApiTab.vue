<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { CuratedWorkflow } from '../../config/workflow-catalogue'
import type { WorkflowGraph } from '../../config/workflow-execution'
import type { SnippetLanguage } from '../../config/models-snippets'
import { SNIPPET_LANGUAGES } from '../../config/models-snippets'
import {
  buildWorkflowSnippet,
  WORKFLOW_API_BASE,
  WORKFLOW_JOB_PATH,
  workflowInputs
} from '../../config/workflow-snippets'
import { externalLinks } from '../../config/routes'
import { useTablist } from '../../composables/useTablist'
import type { CodeLang } from '../../lib/highlight'
import CopyTextButton from '../ui/copy-text-button/CopyTextButton.vue'
import Button from '../ui/button/Button.vue'
import HighlightedCode from './HighlightedCode.vue'

const {
  workflow,
  graph,
  values = {}
} = defineProps<{
  workflow: CuratedWorkflow
  graph: WorkflowGraph
  values?: Readonly<Record<string, string | number>>
}>()
const language = ref<SnippetLanguage>('python')
const { onKeydown } = useTablist(() => SNIPPET_LANGUAGES, language)
const deployed = workflow.execution === 'deployment-demo'
const snippet = computed(() =>
  buildWorkflowSnippet(language.value, workflow, graph, values)
)
const inputs = computed(() =>
  workflowInputs(workflow, graph, values).filter((input) => input.filename)
)
const languages: Record<SnippetLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
  curl: 'cURL'
}
const highlightLanguages: Record<SnippetLanguage, CodeLang> = {
  python: 'python',
  typescript: 'typescript',
  curl: 'shell'
}
const installation = computed(() =>
  language.value === 'python'
    ? 'pip install comfy-sdk'
    : language.value === 'typescript'
      ? 'npm install @comfyorg/sdk'
      : 'Requires bash, curl, jq, and uuidgen.'
)
function downloadGraph() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${workflow.slug}.api.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-6" aria-label="Workflow API">
    <div class="space-y-2">
      <h2 class="text-2xl font-bold text-primary-comfy-canvas">
        Build with this workflow
      </h2>
      <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
        {{
          deployed
            ? 'Run this workflow on your own Comfy API deployment, with its models and custom nodes.'
            : 'Run the complete workflow through Comfy Cloud’s API: upload your inputs, submit a job, and download the outputs.'
        }}
      </p>
    </div>
    <div class="space-y-3 rounded-2xl border border-transparency-white-t20 p-5">
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span
          class="rounded-md bg-primary-comfy-yellow px-2 py-1 font-mono text-primary-comfy-ink"
          >POST</span
        >
        <code class="min-w-0 break-all text-primary-warm-white"
          >{{
            deployed ? 'https://{deployment}.run.comfy.app' : WORKFLOW_API_BASE
          }}{{ WORKFLOW_JOB_PATH }}</code
        >
      </div>
      <p class="text-sm/relaxed text-primary-warm-gray">
        {{
          deployed
            ? 'Deploy first: this interactive demo has no live endpoint. Set COMFY_BASE_URL to the active URL from your Comfy API deployment.'
            : 'Requires a paid Cloud plan and available credits. Availability depends on the models and nodes in this workflow.'
        }}
      </p>
      <a
        v-if="deployed"
        href="https://docs.comfy.org/development/serverless/overview"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center text-sm text-primary-comfy-yellow"
        >Set up a Comfy API deployment ↗</a
      >
    </div>
    <div class="space-y-3 text-sm/relaxed text-primary-warm-gray">
      <p>
        Download
        <strong class="font-medium text-primary-warm-white"
          >{{ workflow.slug }}.api.json</strong
        >, place your input files alongside your script, and set
        <code>COMFY_API_KEY</code> in your server environment. These examples
        use the current prompt and settings.
      </p>
      <code
        class="block overflow-x-auto rounded-xl bg-transparency-white-t8 px-4 py-3 text-primary-warm-white"
        >{{ installation }}</code
      >
      <p v-if="inputs.length">
        Local input files:
        <span
          v-for="(input, index) in inputs"
          :key="`${input.node}.${input.input}`"
          >{{ index ? ' · ' : '' }}{{ input.label }}:
          <code class="text-primary-warm-white">{{
            input.filename
          }}</code></span
        >. Replace these paths with your own files.
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
          aria-label="Code language"
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
            {{ languages[option] }}
          </button>
        </div>
        <CopyTextButton
          :value="snippet"
          label="Copy snippet"
          copied-label="Copied"
        />
      </div>
      <pre
        id="workflow-snippet-panel"
        role="tabpanel"
        :aria-labelledby="`workflow-snippet-${language}`"
        tabindex="0"
        class="max-h-[640px] overflow-auto bg-primary-comfy-ink p-6 font-mono text-sm/relaxed text-primary-warm-white"
        data-testid="workflow-snippet"
      ><HighlightedCode :code="snippet" :language="highlightLanguages[language]" /></pre>
    </div>
    <p
      v-if="language === 'curl'"
      class="text-sm/relaxed text-primary-warm-gray"
    >
      This example submits once and reads the current job status. Poll the
      returned <code>urls.self</code> until the job succeeds, then retrieve its
      output assets. Keep the job ID to resume observation without resubmitting.
    </p>
    <div class="flex flex-wrap gap-3">
      <Button @click="downloadGraph">Download API graph</Button>
      <Button
        as="a"
        :href="externalLinks.apiKeys"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        >Get API key</Button
      >
      <Button
        as="a"
        href="https://docs.comfy.org/development/api-development/sdks"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        >API documentation</Button
      >
    </div>
    <p class="text-xs/relaxed text-primary-warm-gray">
      Examples follow the documented Comfy API v2 contract. Live generation has
      not been verified for every template.
    </p>
  </section>
</template>
