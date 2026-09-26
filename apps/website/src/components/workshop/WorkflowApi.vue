<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { apiKeysLink } from '../../config/routes'
import type { FormValues } from '../../config/workshop-playground'
import { urlUploadField } from '../../config/workshop-playground'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
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
    <Button as="a" :href="keyHref" target="_blank" rel="noopener">{{
      t('workshop.api.getKey')
    }}</Button>
  </section>
</template>
