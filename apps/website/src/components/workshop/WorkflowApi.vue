<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { apiKeysLink, externalLinks } from '../../config/routes'
import type { FormValues } from '../../config/workshop-playground'
import { urlUploadField } from '../../config/workshop-playground'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { workspaceLinkedHref } from '../../config/workshop-workspace-link'
import {
  workflowCurl,
  workflowSnippetRequest
} from '../../config/workshop-workflow-snippet'
import { t } from '../../i18n/translations'
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
const code = computed(() => (request.value ? workflowCurl(request.value) : ''))
const hasMedia = initialWorkshopPageState(model).schema.some((field) =>
  urlUploadField(field)
)
const endpoint = `${WORKSHOP_CLOUD_BASE_URL}/api/prompt`
const facts = computed(() => [
  {
    label: t('workshop.api.needsEndpoint'),
    value: `POST ${endpoint}`,
    mono: true
  },
  {
    label: t('workshop.api.needsKey'),
    value: 'X-API-Key + extra_data.api_key_comfy_org',
    mono: true
  },
  ...(hasMedia
    ? [
        {
          label: t('workshop.api.needsFiles'),
          value: t('workshop.api.filesUploaded')
        }
      ]
    : [])
])
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
          class="w-full justify-center"
          data-testid="api-get-key"
          >{{ t('workshop.api.getKey') }}</Button
        >
        <div data-testid="workflow-api-endpoint">
          <ApiFacts :where="t('workshop.api.runsOnCloud')" :rows="facts" />
        </div>
        <p class="text-sm/relaxed text-primary-warm-gray">
          {{ t('workshop.workflow.apiNote') }}
        </p>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-4">
        <div
          v-if="code"
          class="overflow-hidden rounded-2xl border border-transparency-white-t20"
        >
          <div
            class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-2 text-sm text-primary-warm-gray"
          >
            <span>cURL</span
            ><CopyTextButton
              :value="code"
              :label="t('workshop.api.copy')"
              :copied-label="t('workshop.api.copied')"
            />
          </div>
          <pre
            tabindex="0"
            class="max-h-168 overflow-auto bg-primary-comfy-ink p-6 text-sm/relaxed text-primary-warm-white"
            data-testid="workflow-api-snippet"
          ><HighlightedCode :code="code" language="shell" /></pre>
        </div>
        <p v-else role="status" class="text-sm text-primary-warm-gray">
          {{ t('workshop.api.inputInvalid') }}
        </p>

        <div
          v-if="hasMedia"
          class="space-y-2 text-sm/relaxed text-primary-warm-gray"
        >
          <h3 class="font-medium text-primary-comfy-canvas">
            {{ t('workshop.workflow.apiUploads') }}
          </h3>
          <p>{{ t('workshop.workflow.apiUploadGrant') }}</p>
          <p>{{ t('workshop.workflow.apiUploadPut') }}</p>
          <p>{{ t('workshop.workflow.apiUploadFinalize') }}</p>
        </div>

        <p class="text-sm/relaxed text-primary-warm-gray">
          {{ t('workshop.workflow.apiPoll') }}
        </p>
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
