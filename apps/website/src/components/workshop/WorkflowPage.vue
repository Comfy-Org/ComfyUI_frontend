<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { t } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import WorkflowPlayground from './WorkflowPlayground.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const emit = defineEmits<{ recovery: [active: boolean] }>()
const { session } = useWorkshopSession()
const scope = computed(() =>
  session.value
    ? JSON.stringify([session.value.uid, session.value.workspace.id])
    : 'anonymous'
)
const routes = getRoutes()

// The one thing the eyebrow can lead somewhere: the shelf this workflow sits
// on. It was a word before, and a word is not a way back.
const shelf = computed(() => {
  const useCase = useCaseFor(model)
  const category = model.category
  return useCase
    ? {
        label: useCaseLabelKey[useCase],
        href: category
          ? `${routes.hubWorkflows}?${new URLSearchParams({ category })}`
          : routes.hubWorkflows
      }
    : undefined
})
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'

const downloadUrl = model.workflow.template?.downloadUrl

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const modelAnalytics = workshopModelAnalytics(model)

function captureWorkflowDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: modelAnalytics
    })
}
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <a
      :href="routes.hubWorkflows"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('workshop.catalogue.backToWorkflows') }}
    </a>
    <header class="mb-9" data-testid="workflow-hero">
      <div v-if="shelf" class="mb-3 flex flex-wrap items-center gap-3">
        <a
          :href="shelf.href"
          :class="pillClass"
          data-testid="workflow-use-case"
          >{{ t(shelf.label) }}</a
        >
      </div>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ model.name }}
      </h1>
      <p
        v-if="model.summary"
        class="mt-4 text-lg text-primary-warm-gray lg:truncate"
        :title="model.summary"
      >
        {{ model.summary }}
      </p>
      <div
        v-if="downloadUrl"
        class="mt-6 flex flex-wrap items-center gap-2"
        data-testid="workflow-actions"
      >
        <Button
          as="a"
          :href="downloadUrl"
          download
          variant="secondaryOutline"
          class="h-auto min-h-11 max-w-full whitespace-normal"
          :aria-label="t('workshop.workflow.download')"
          @click="captureWorkflowDownload"
          >{{ t('workshop.workflow.downloadShort') }}</Button
        >
      </div>
    </header>

    <WorkflowPlayground
      :key="scope"
      :model="model"
      :scope="scope"
      @recovery="emit('recovery', $event)"
    />
  </div>
</template>
