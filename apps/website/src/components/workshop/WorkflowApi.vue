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
import HighlightedCode from './HighlightedCode.vue'

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
</script>

<template>
  <section class="space-y-6" aria-labelledby="workflow-api-heading">
    <div class="space-y-2">
      <h2
        id="workflow-api-heading"
        class="text-2xl font-light text-primary-comfy-canvas"
      >
        {{ t('workshop.api.heading') }}
      </h2>
      <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.apiHint') }}
      </p>
    </div>
    <div
      class="flex flex-col gap-3 rounded-2xl border border-transparency-white-t20 p-5"
      data-testid="workflow-api-endpoint"
    >
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <span
          class="rounded-md bg-primary-comfy-yellow px-2 py-1 font-mono text-primary-comfy-ink"
          >POST</span
        >
        <code class="min-w-0 break-all text-primary-warm-white">{{
          endpoint
        }}</code>
      </div>
      <p class="text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.apiNote') }}
      </p>
    </div>
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
      class="max-w-3xl space-y-2 text-sm/relaxed text-primary-warm-gray"
    >
      <h3 class="font-medium text-primary-comfy-canvas">
        {{ t('workshop.workflow.apiUploads') }}
      </h3>
      <p>{{ t('workshop.workflow.apiUploadGrant') }}</p>
      <p>{{ t('workshop.workflow.apiUploadPut') }}</p>
      <p>{{ t('workshop.workflow.apiUploadFinalize') }}</p>
    </div>
    <p class="max-w-3xl text-sm/relaxed text-primary-warm-gray">
      {{ t('workshop.workflow.apiPoll') }}
    </p>
    <div class="flex flex-wrap gap-3">
      <Button as="a" :href="keyHref" target="_blank" rel="noopener">{{
        t('workshop.api.getKey')
      }}</Button>
      <Button
        as="a"
        :href="externalLinks.docsApi"
        target="_blank"
        rel="noopener"
        variant="outline"
        >{{ t('workshop.workflow.apiDocs') }}</Button
      >
    </div>
  </section>
</template>
