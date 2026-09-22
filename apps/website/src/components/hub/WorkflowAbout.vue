<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import WorkflowActions from './WorkflowActions.vue'
import WorkflowFacts from './WorkflowFacts.vue'
import WorkflowGraph from './WorkflowGraph.vue'

interface Tag {
  readonly label: string
  readonly href: string
}

const {
  graphUrl,
  cloudUrl,
  runsHere,
  tutorialUrl,
  description,
  models,
  tags,
  author,
  usage,
  produces,
  added,
  locale = 'en'
} = defineProps<{
  graphUrl: string
  cloudUrl: string
  runsHere: boolean
  tutorialUrl: string | undefined
  /** What the registry says this workflow is for. */
  description: string | undefined
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  tags: readonly Tag[]
  author: string
  usage: number
  produces: readonly HubPortSummary[]
  added: string
  locale?: Locale
}>()

const sectionTitle =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <div class="grid gap-10 lg:grid-cols-12" data-testid="workflow-about">
    <div class="flex flex-col gap-12 lg:col-span-8">
      <p
        v-if="description"
        class="max-w-2xl text-base/relaxed text-primary-comfy-canvas/80"
        data-testid="workflow-summary"
      >
        {{ description }}
      </p>

      <section data-testid="workflow-graph-section">
        <h2 :class="sectionTitle">
          {{ t('workshop.v2.workflow.graph', locale) }}
        </h2>
        <p class="mt-2 mb-4 text-sm text-content-muted">
          {{ t('workshop.v2.workflow.graphNote', locale) }}
        </p>
        <WorkflowGraph :source="graphUrl" :locale />
      </section>
    </div>

    <div class="lg:col-span-4">
      <div class="flex flex-col gap-4 lg:sticky lg:top-28">
        <WorkflowActions
          :cloud-url="cloudUrl"
          :download-url="graphUrl"
          :tutorial-url="tutorialUrl"
          :locale
        />
        <WorkflowFacts
          :models
          :tags
          :author
          :usage
          :produces
          :runs-here="runsHere"
          :added
          :locale
        />
      </div>
    </div>
  </div>
</template>
