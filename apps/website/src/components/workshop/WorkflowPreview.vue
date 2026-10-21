<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { translationsFor } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import SectionHeading from './SectionHeading.vue'
import WorkflowFacts from './WorkflowFacts.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphVersions from './WorkflowNodeGraphVersions.vue'

const { model, active = true } = defineProps<{
  model: WorkflowWorkshopModelDetail
  /** Whether this tab is showing; the graph waits until it first is. */
  active?: boolean
}>()
const locale = computed(() => model.catalogDetails?.locale ?? 'en')
const t = computed(() => translationsFor(locale.value).t)

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const modelAnalytics = workshopModelAnalytics(model)

// The page header downloads the default file; only a workflow offering
// several versions picks one here, and the graph follows the pick.
function captureWorkflowDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: { ...modelAnalytics, placement: 'versions' }
    })
}

const template = computed(() => model.workflow.template)
const files = computed(() => model.catalogDetails?.workflowFiles)
const selectedFile = ref<string>()
const downloadHref = computed(() =>
  files.value
    ? (files.value.find((file) => file.href === selectedFile.value)?.href ??
      files.value.at(-1)?.href)
    : template.value?.downloadUrl
)
watch(
  () => model.slug,
  () => {
    selectedFile.value = undefined
  }
)
// What the workflow makes, hung in the node that hands it back. The samples
// beneath it are results too, so there is no before to hang at the way in, and
// a node cannot play a video.
const samples = computed(() =>
  model.thumbnail?.kind === 'image' ? [model.thumbnail.url] : []
)
</script>

<template>
  <section
    id="workflow-panel-workflow"
    role="tabpanel"
    aria-labelledby="workflow-tab-workflow"
  >
    <SectionHeading
      class="mb-8"
      :title="t('workshop.workflow.inside')"
      :subtitle="t('workshop.workflow.previewHint')"
    />

    <div class="grid gap-10 lg:grid-cols-12">
      <div class="lg:col-span-8">
        <WorkflowGraph
          v-if="downloadHref"
          :key="downloadHref"
          :source="downloadHref"
          :samples
          :fallback="files ? undefined : template?.previewUrl"
          :full-href="files ? downloadHref : template?.previewUrl"
          :active
        />
        <a
          v-else-if="!files && template?.previewUrl"
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
          <WorkflowNodeGraphVersions
            v-if="files && files.length > 1"
            :files
            :selected="downloadHref"
            :download-name="`${model.slug.split('/').pop()}.json`"
            :locale
            @select="selectedFile = $event"
            @download="captureWorkflowDownload"
          />

          <WorkflowFacts :model />
        </div>
      </div>
    </div>
  </section>
</template>
