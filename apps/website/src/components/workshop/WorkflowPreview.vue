<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
import WorkflowFacts from './WorkflowFacts.vue'
import WorkflowGraph from './WorkflowGraph.vue'

const {
  model,
  standalone = false,
  active = true
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  /** Shown as the page's body when the workflow has no Run panel. */
  standalone?: boolean
  /** Whether this tab is showing; the graph waits until it first is. */
  active?: boolean
}>()
const t = computed(
  () => translationsFor(model.catalogDetails?.locale ?? 'en').t
)

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const modelAnalytics = workshopModelAnalytics(model)

// The page header downloads the default file; only a workflow offering
// several versions picks one here, and the graph follows the pick.
function captureWorkflowDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: modelAnalytics
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
function selectFile(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const value = event.target.value
  const file = files.value?.find((item) => item.href === value)
  selectedFile.value = file?.href
}
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
    :role="standalone ? undefined : 'tabpanel'"
    :aria-labelledby="standalone ? undefined : 'workflow-tab-workflow'"
  >
    <SectionHeading
      v-if="!standalone"
      class="mb-8"
      :title="t('workshop.workflow.inside')"
      :subtitle="t('workshop.workflow.previewHint')"
    />

    <div
      :class="
        standalone
          ? 'grid gap-8 lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:gap-16'
          : 'grid gap-10 lg:grid-cols-12'
      "
    >
      <div :class="standalone ? 'min-w-0 lg:order-2' : 'lg:col-span-8'">
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

      <div :class="standalone ? 'min-w-0 lg:order-1' : 'lg:col-span-4'">
        <div class="flex flex-col gap-4 lg:sticky lg:top-24">
          <div
            v-if="files && files.length > 1"
            class="flex flex-col gap-3"
            data-testid="workflow-versions"
          >
            <label class="grid gap-2 text-sm text-primary-warm-gray">
              {{ t('cccWorkflow.version') }}
              <select
                :value="downloadHref"
                class="min-h-11 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-primary-comfy-canvas"
                @change="selectFile"
              >
                <option
                  v-for="file in files"
                  :key="file.href"
                  :value="file.href"
                >
                  {{ file.name }}
                </option>
              </select>
            </label>
            <Button
              as="a"
              :href="downloadHref"
              :download="`${model.slug.split('/').pop()}.json`"
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
