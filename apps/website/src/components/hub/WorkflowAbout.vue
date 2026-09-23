<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import type { WorkflowReach } from '../../lib/hub/workflow-reach'
import WorkflowActions from './WorkflowActions.vue'
import WorkflowFacts from './WorkflowFacts.vue'
import WorkflowGraph from './WorkflowGraph.vue'

const {
  graphUrl,
  cloudUrl,
  reach,
  tutorialUrl,
  models,
  samples,
  author,
  usage,
  produces,
  openWeights,
  added,
  locale = 'en'
} = defineProps<{
  graphUrl: string
  cloudUrl: string
  /** What the workflow does, in the template author's own words. */
  reach: WorkflowReach | undefined
  tutorialUrl: string | undefined
  /** The template's own pictures, hung in the nodes that hold them. */
  samples: readonly string[]
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  author: string
  usage: number
  produces: readonly HubPortSummary[]
  /** Whether the weights behind it can be downloaded and run anywhere. */
  openWeights: boolean
  added: string
  locale?: Locale
}>()

const sectionTitle =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <div class="grid gap-10 lg:grid-cols-12" data-testid="workflow-about">
    <div class="flex flex-col gap-12 lg:col-span-8">
      <section data-testid="workflow-graph-section">
        <div class="mb-8">
          <h2 :class="sectionTitle">
            {{ tHub('workshop.v2.workflow.about', locale) }}
          </h2>
          <p class="mt-2 text-sm/relaxed text-content-muted">
            {{ tHub('workshop.v2.workflow.graphNote', locale) }}
          </p>
        </div>
        <WorkflowGraph :source="graphUrl" :samples :locale />
      </section>
    </div>

    <div class="lg:col-span-4">
      <div class="flex flex-col gap-4 lg:sticky lg:top-28">
        <WorkflowFacts
          :models
          :author
          :usage
          :produces
          :reach
          :open-weights="openWeights"
          :added
          :locale
        />
        <WorkflowActions
          :cloud-url="cloudUrl"
          :download-url="graphUrl"
          :reach
          :tutorial-url="tutorialUrl"
          stacked
          :locale
        />
      </div>
    </div>
  </div>
</template>
