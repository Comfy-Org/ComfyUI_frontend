<script setup lang="ts">
import { ArrowUpRight, KeyRound } from '@lucide/vue'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { SnippetLanguage } from '@/config/models-snippets'
import { apiKeysLink, externalLinks } from '@/config/routes'
import type { FormValues } from '@/config/workshop-playground'
import { urlUploadField } from '@/config/workshop-playground'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { workspaceLinkedHref } from '@/config/workshop-workspace-link'
import {
  PYTHON_SDK_INSTALL,
  workflowCurl,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest,
  workflowTypeScript
} from '@/config/workshop-workflow-snippet'
import { t } from '@/i18n/translations'
import ApiStep from './ApiStep.vue'
import WorkflowCodePanel from './WorkflowCodePanel.vue'

const { model, values } = defineProps<{
  model: WorkflowWorkshopModelDetail
  values: FormValues
}>()
const emit = defineEmits<{ copy: [language: SnippetLanguage]; getKey: [] }>()
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
const code = computed(() => {
  if (!request.value) return ''
  if (language.value === 'curl') return workflowCurl(request.value)
  const plan = workflowSdkPlan(model, values, request.value)
  return language.value === 'python'
    ? workflowPython(plan)
    : workflowTypeScript(plan)
})
const nodeCount = computed(() =>
  request.value ? Object.keys(request.value.prompt).length : 0
)
const hasMedia = initialWorkshopPageState(model).schema.some((field) =>
  urlUploadField(field)
)
</script>

<template>
  <section aria-labelledby="workflow-api-heading">
    <Card class="gap-8 p-4 sm:p-8 lg:p-10">
      <div
        class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1"
      >
        <div class="flex max-w-3xl flex-col gap-3">
          <h2
            id="workflow-api-heading"
            class="text-3xl/tight font-light text-primary-warm-white lg:text-4xl/tight"
          >
            {{ t('workshop.workflow.apiTitle') }}
          </h2>
          <p class="text-base/relaxed text-primary-comfy-canvas">
            {{ t('workshop.workflow.apiLead') }}
          </p>
        </div>
        <a
          :href="externalLinks.docsApi"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-comfy-yellow transition-opacity hover:opacity-80"
          data-testid="api-docs"
        >
          {{ t('hubPages.workflow.apiDocs') }}
          <span class="sr-only">{{
            t('workshop.workflow.opensInNewTab')
          }}</span>
          <ArrowUpRight class="size-4" aria-hidden="true" />
        </a>
      </div>

      <div class="flex flex-col gap-4">
        <ol class="flex flex-col gap-6">
          <ApiStep
            :step="1"
            :title="t('hubPages.workflow.getApiKey')"
            :body="t('workshop.workflow.apiStepKeyBody')"
            current
          >
            <Button
              as="a"
              :href="keyHref"
              target="_blank"
              rel="noopener"
              class="px-5"
              data-testid="api-get-key"
              @click="emit('getKey')"
            >
              <template #prepend>
                <KeyRound class="size-4" aria-hidden="true" />
              </template>
              {{ t('hubPages.workflow.getApiKey') }}
              <span class="sr-only">{{
                t('workshop.workflow.opensInNewTab')
              }}</span>
            </Button>
          </ApiStep>
          <ApiStep
            :step="2"
            :title="t('workshop.workflow.apiStepSdk')"
            :body="t('workshop.workflow.apiStepSdkBody')"
          >
            <CopyableField
              :value="PYTHON_SDK_INSTALL"
              :copy-label="t('workshop.workflow.apiCopyInstall')"
              :copied-label="t('workshop.api.copied')"
              class="h-10 w-full py-0 lg:w-80"
            />
          </ApiStep>
          <ApiStep
            :step="3"
            :title="t('workshop.workflow.apiStepRun')"
            :body="t('workshop.workflow.apiStepRunBody')"
          />
        </ol>

        <WorkflowCodePanel
          v-if="code"
          v-model:language="language"
          :code="code"
          :node-count="nodeCount"
          @copy="emit('copy', $event)"
        />
        <p v-else role="status" class="text-sm text-primary-warm-gray">
          {{ t('workshop.api.inputInvalid') }}
        </p>

        <details
          v-if="code && language === 'curl'"
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
      </div>
    </Card>
  </section>
</template>
