<script setup lang="ts">
import WorkflowApiSteps from './WorkflowApiSteps.vue'
import { computed, ref, watch } from 'vue'
import { Download } from '@lucide/vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { SnippetLanguage } from '@/config/models-snippets'
import { SNIPPET_LANGUAGES } from '@/config/models-snippets'
import { apiKeysLink, externalLinks } from '@/config/routes'
import type { FormValues } from '@/config/workshop-playground'
import { urlUploadField } from '@/config/workshop-playground'
import { OBJECT_URL_LIFETIME_MS } from '@/config/workshop-output-download'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { WorkshopWorkflowError } from '@/config/workshop-workflow-api'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { workspaceLinkedHref } from '@/config/workshop-workspace-link'
import {
  workflowCurl,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest,
  workflowTypeScript
} from '@/config/workshop-workflow-snippet'
import { translationsFor } from '@/i18n/translations'
import WorkflowApiSetup from './WorkflowApiSetup.vue'
import WorkflowSnippet from './WorkflowSnippet.vue'
import SectionHeading from './SectionHeading.vue'

const {
  model,
  values,
  downloadOnly = false
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  values: FormValues
  downloadOnly?: boolean
}>()
const locale = computed(() => model.catalogDetails?.locale ?? 'en')
const t = computed(() => translationsFor(locale.value).t)
const documentationURL = computed(
  () => model.catalogDetails?.documentationURL ?? externalLinks.docsApi
)
const emit = defineEmits<{ copy: [language: SnippetLanguage]; getKey: [] }>()
const { session } = useWorkshopSession()
const keyHref = computed(() =>
  workspaceLinkedHref(
    apiKeysLink({ onboarding: 'models', model: model.slug }),
    session.value?.workspace.id
  )
)
const inferred = computed(() => {
  if (model.type !== 'CLOUD') return { fallback: true }
  try {
    return { request: workflowSnippetRequest(model, values), fallback: false }
  } catch (error) {
    return {
      fallback: !(
        error instanceof WorkshopWorkflowError && error.code === 'invalid_input'
      )
    }
  }
})
const request = computed(() => inferred.value.request)
const language = ref<SnippetLanguage>('python')
const languages = computed(() =>
  request.value
    ? SNIPPET_LANGUAGES
    : SNIPPET_LANGUAGES.filter(
        (lang) =>
          inferred.value.fallback &&
          model.catalogDetails?.scriptCode?.[lang]?.trim()
      )
)
watch(
  languages,
  (available) => {
    if (!available.includes(language.value))
      language.value = available[0] ?? 'python'
  },
  { immediate: true }
)
const code = computed(() => {
  if (!request.value && inferred.value.fallback)
    return model.catalogDetails?.scriptCode?.[language.value] ?? ''
  if (!request.value) return ''
  if (language.value === 'curl') return workflowCurl(request.value)
  const plan = workflowSdkPlan(model, values, request.value)
  return language.value === 'python'
    ? workflowPython(plan)
    : workflowTypeScript(plan)
})
const graphFile = `${model.slug.split('/').pop()}-api.json`
const apiFile = computed(() => model.catalogDetails?.apiWorkflowFile)
const visible = computed(
  () =>
    !downloadOnly || request.value || languages.value.length || apiFile.value
)
const heading = computed(() =>
  t.value(downloadOnly ? 'cccWorkflow.codeHeading' : 'workshop.api.heading')
)
const hint = computed(() =>
  t.value(downloadOnly ? 'cccWorkflow.codeHint' : 'workshop.workflow.apiHint')
)
const unavailableText = computed(() =>
  t.value(
    downloadOnly ? 'cccWorkflow.codeUnavailable' : 'workshop.api.inputInvalid'
  )
)

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
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS)
}
const hasMedia = initialWorkshopPageState(model).schema.some((field) =>
  urlUploadField(field)
)
const endpoint = `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`
const facts = computed(() => {
  const sdk = language.value !== 'curl'
  return [
    ...(sdk
      ? []
      : [
          {
            label: t.value('workshop.api.needsEndpoint'),
            value: `POST ${endpoint}`,
            mono: true,
            copyLabel: t.value('workshop.api.copyEndpoint')
          }
        ]),
    {
      label: t.value('workshop.api.needsKey'),
      value: sdk ? 'COMFY_API_KEY' : 'X-API-Key + extra_data.api_key_comfy_org',
      mono: true
    },
    ...(hasMedia
      ? [
          {
            label: t.value('workshop.api.needsFiles'),
            value: sdk
              ? t.value('workshop.api.filesSdk')
              : t.value('workshop.api.filesUploaded')
          }
        ]
      : [])
  ]
})
</script>

<template>
  <section
    v-if="visible"
    class="flex flex-col gap-6"
    aria-labelledby="workflow-api-heading"
  >
    <SectionHeading
      title-id="workflow-api-heading"
      :title="heading"
      :subtitle="hint"
    />
    <div class="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
      <WorkflowApiSetup
        v-if="request || !downloadOnly"
        :key-href="keyHref"
        :show-download="Boolean(request) && !apiFile"
        :facts
        :locale
        @get-key="emit('getKey')"
        @download="downloadGraph"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <a
          v-if="apiFile"
          :href="apiFile.href"
          :download="graphFile"
          class="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-transparency-white-t20 px-4 py-2 text-sm font-medium text-primary-comfy-yellow hover:border-primary-comfy-yellow hover:text-primary-warm-white focus-visible:outline-2 focus-visible:outline-primary-comfy-yellow"
        >
          <Download class="size-4" aria-hidden="true" />
          {{ t('cccWorkflow.downloadApiJSON') }}
        </a>
        <WorkflowSnippet
          v-if="code"
          v-model="language"
          :code
          :languages
          :locale
          @copy="emit('copy', $event)"
        />
        <p v-else role="status" class="text-sm text-primary-warm-gray">
          {{ unavailableText }}
        </p>

        <WorkflowApiSteps
          v-if="request && language === 'curl'"
          :has-media="hasMedia"
          :locale
        />
        <a
          :href="documentationURL"
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
