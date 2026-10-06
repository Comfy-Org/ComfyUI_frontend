<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { translationsFor } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowFacts from '@/components/workshop/workflow-preview/WorkflowFacts.vue'

const { t } = translationsFor('en')
const {
  model,
  cloudHref,
  active = true,
  withActions = true
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  cloudHref?: string
  /** Whether the section has been reached; the graph waits until it is. */
  active?: boolean
  withActions?: boolean
}>()

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const modelAnalytics = workshopModelAnalytics(model)

function captureTryInCloud() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'try_in_cloud_clicked',
      properties: modelAnalytics
    })
}

function captureWorkflowDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: modelAnalytics
    })
}

const template = computed(() => model.workflow.template)
// What the workflow makes, hung in the node that hands it back. The samples
// beneath it are results too, so there is no before to hang at the way in, and
// a node cannot play a video.
const samples = computed(() =>
  model.thumbnail?.kind === 'image' ? [model.thumbnail.url] : []
)
</script>

<template>
  <section aria-labelledby="workflow-inside-heading">
    <SectionHeading
      class="mb-8"
      title-id="workflow-inside-heading"
      :title="t('workshop.workflow.inside')"
      :subtitle="t('workshop.workflow.previewHint')"
    />

    <div class="grid gap-10 lg:grid-cols-12">
      <div class="lg:col-span-8">
        <WorkflowGraph
          v-if="template?.downloadUrl"
          :key="model.slug"
          :source="template.downloadUrl"
          :samples
          :fallback="template.previewUrl"
          :full-href="template.previewUrl"
          :active
        />
        <a
          v-else-if="template?.previewUrl"
          :href="template.previewUrl"
          target="_blank"
          rel="noopener"
          :aria-label="t('workshop.workflow.fullPreview')"
          class="block overflow-hidden rounded-2xl border border-transparency-white-t8 focus-visible:outline-primary-comfy-yellow"
        >
          <img
            :src="template.previewUrl"
            :alt="t('workshop.workflow.graph')"
            loading="lazy"
            class="max-h-160 w-full object-contain"
          />
        </a>
      </div>

      <div class="lg:col-span-4">
        <div class="flex flex-col gap-4 lg:sticky lg:top-24">
          <div
            v-if="withActions"
            class="flex flex-col gap-3"
            data-testid="workflow-actions"
          >
            <Button
              v-if="cloudHref"
              as="a"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureTryInCloud"
              >{{ t('workshop.workflow.tryCloud') }}</Button
            >
            <Button
              v-if="template?.downloadUrl"
              as="a"
              :href="template.downloadUrl"
              download
              variant="outline"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureWorkflowDownload"
              >{{ t('workshop.workflow.download') }}</Button
            >
          </div>

          <WorkflowFacts :model />
        </div>
      </div>
    </div>
  </section>
</template>
