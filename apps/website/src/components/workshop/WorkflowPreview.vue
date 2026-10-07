<script setup lang="ts">
import { computed } from 'vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { translationsFor } from '@/i18n/translations'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowFacts from '@/components/workshop/workflow-preview/WorkflowFacts.vue'

const { t } = translationsFor('en')
const { model, active = true } = defineProps<{
  model: WorkflowWorkshopModelDetail
  /** Whether the section has been reached; the graph waits until it is. */
  active?: boolean
}>()

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

    <div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
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
          <WorkflowFacts :model />
        </div>
      </div>
    </div>
  </section>
</template>
