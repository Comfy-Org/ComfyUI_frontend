<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useTablist } from '../../composables/useTablist'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import type { SnippetLanguage } from '../../config/models-snippets'
import { SNIPPET_LANGUAGES } from '../../config/models-snippets'
import { apiKeysLink, externalLinks } from '../../config/routes'
import type { FormValues } from '../../config/workshop-playground'
import { urlUploadField } from '../../config/workshop-playground'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { workspaceLinkedHref } from '../../config/workshop-workspace-link'
import {
  workflowCurl,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest,
  workflowTypeScript
} from '../../config/workshop-workflow-snippet'
import { t } from '../../i18n/translations'
import type { CodeLang } from '../../lib/highlight'
import ApiFacts from './ApiFacts.vue'
import HighlightedCode from './HighlightedCode.vue'
import SectionHeading from './SectionHeading.vue'

const { model, values } = defineProps<{
  model: WorkflowWorkshopModelDetail
  values: FormValues
}>()
const { session } = useWorkshopSession()
const keyHref = computed(() =>
  workspaceLinkedHref(
    apiKeysLink({ onboarding: 'models', model: model.slug }),
    session.value?.workspace.id
  )
)
const request = computed(() => {
  if (model.type !== 'CLOUD') return undefined
  try {
    return workflowSnippetRequest(model, values)
  } catch {
    return undefined
  }
})
const language = ref<SnippetLanguage>('python')
const { onKeydown: onLanguageKeydown } = useTablist(
  () => SNIPPET_LANGUAGES,
  language
)
const code = computed(() => {
  if (!request.value) return ''
  if (language.value === 'curl') return workflowCurl(request.value)
  const plan = workflowSdkPlan(model, values, request.value)
  return language.value === 'python'
    ? workflowPython(plan)
    : workflowTypeScript(plan)
})
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
const graphFile = `${model.slug.split('/').pop()}-api.json`

function downloadGraph() {
  if (!request.value) return
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(request.value.prompt, null, 2)], {
      type: 'application/json'
    })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = graphFile
  anchor.click()
  URL.revokeObjectURL(url)
}
const hasMedia = initialWorkshopPageState(model).schema.some((field) =>
  urlUploadField(field)
)
const endpoint = `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`
const sdkFacts = {
  python: {
    key: 'Comfy(api_key=…) + run(workflow, api_key=…)',
    files: 'client.assets.from_url(url)'
  },
  typescript: {
    key: 'new Comfy({ apiKey }) + run(workflow, { apiKey })',
    files: 'client.assets.fromUrl(url)'
  }
} as const
const facts = computed(() => {
  const current = language.value
  const sdk = current === 'curl' ? undefined : sdkFacts[current]
  return [
    ...(sdk === undefined
      ? [
          {
            label: t('workshop.api.needsEndpoint'),
            value: `POST ${endpoint}`,
            mono: true
          }
        ]
      : []),
    {
      label: t('workshop.api.needsKey'),
      value: sdk?.key ?? 'X-API-Key + extra_data.api_key_comfy_org',
      mono: true
    },
    ...(hasMedia
      ? [
          {
            label: t('workshop.api.needsFiles'),
            value: sdk?.files ?? t('workshop.api.filesUploaded'),
            mono: Boolean(sdk)
          }
        ]
      : [])
  ]
})
</script>

<template>
  <section class="flex flex-col gap-6" aria-labelledby="workflow-api-heading">
    <SectionHeading
      title-id="workflow-api-heading"
      :title="t('workshop.api.heading')"
      :subtitle="t('workshop.workflow.apiHint')"
    />
    <div class="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
      <div
        class="flex w-full flex-col gap-3 lg:sticky lg:top-24 lg:w-95 lg:shrink-0"
      >
        <Button
          as="a"
          :href="keyHref"
          target="_blank"
          rel="noopener"
          class="w-full justify-between"
          data-testid="api-get-key"
        >
          <template #prepend>
            <span
              class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-ink/15 text-xs font-bold"
              aria-hidden="true"
              >1</span
            >
          </template>
          {{ t('workshop.api.getKey') }}
          <template #append><span aria-hidden="true">↗</span></template>
        </Button>
        <Button
          v-if="request"
          variant="outline"
          class="w-full justify-between"
          @click="downloadGraph"
        >
          <template #prepend>
            <span
              class="inline-flex size-6 items-center justify-center rounded-full bg-primary-comfy-yellow/15 text-xs font-bold"
              aria-hidden="true"
              >2</span
            >
          </template>
          {{ t('workshop.api.downloadGraph') }}
          <template #append><span aria-hidden="true">↓</span></template>
        </Button>
        <div data-testid="workflow-api-endpoint">
          <ApiFacts
            :where="t('workshop.api.runsOnCloud')"
            :rows="facts"
            :note="t('workshop.workflow.apiNote')"
          />
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <div
          v-if="code"
          class="overflow-hidden rounded-2xl border border-transparency-white-t20"
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
        <p v-else role="status" class="text-sm text-primary-warm-gray">
          {{ t('workshop.api.inputInvalid') }}
        </p>

        <details
          v-if="language === 'curl'"
          class="rounded-2xl border border-transparency-white-t8 px-5"
          data-testid="workflow-api-steps"
        >
          <summary
            class="cursor-pointer list-none py-4 text-sm font-medium text-primary-comfy-canvas marker:hidden hover:text-primary-warm-white"
          >
            {{ t('workshop.workflow.apiSteps') }}
           </summary>
           <div class="space-y-2 pb-5 text-sm/relaxed text-primary-warm-gray">
             <template v-if="hasMedia">
               <h3 class="font-medium text-primary-comfy-canvas">
                 {{ t('workshop.workflow.apiUploads') }}
               </h3>
               <ol class="list-decimal space-y-1 ps-5">
                 <li>{{ t('workshop.workflow.apiUploadGrant') }}</li>
                 <li>{{ t('workshop.workflow.apiUploadPut') }}</li>
                 <li>{{ t('workshop.workflow.apiUploadFinalize') }}</li>
               </ol>
             </template>
             <p>{{ t('workshop.workflow.apiPoll') }}</p>
           </div>
         </details>

        <a
          :href="externalLinks.docsApi"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary-comfy-yellow hover:text-primary-warm-white"
          data-testid="api-docs"
        >
          {{ t('workshop.workflow.apiDocs') }}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>
</template>
