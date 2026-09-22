<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import WorkflowActions from './WorkflowActions.vue'
import WorkflowFacts from './WorkflowFacts.vue'
import WorkflowGraph from './WorkflowGraph.vue'

const {
  graphUrl,
  cloudUrl,
  runsHere,
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
  runsHere: boolean
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
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 :class="sectionTitle">
              {{ t('workshop.v2.workflow.graph', locale) }}
            </h2>
            <p class="mt-2 text-sm text-content-muted">
              {{ t('workshop.v2.workflow.graphNote', locale) }}
            </p>
          </div>
          <WorkflowActions
            :cloud-url="cloudUrl"
            :download-url="graphUrl"
            :tutorial-url="tutorialUrl"
            :only="['cloud']"
            :locale
          />
        </div>
        <WorkflowGraph :source="graphUrl" :samples :locale />
      </section>
    </div>

    <div class="lg:col-span-4">
      <div class="flex flex-col gap-4 lg:sticky lg:top-28">
        <WorkflowActions
          :cloud-url="cloudUrl"
          :download-url="graphUrl"
          :tutorial-url="tutorialUrl"
          :only="['download', 'tutorial']"
          :locale
        />
        <WorkflowFacts
          :models
          :author
          :usage
          :produces
          :runs-here="runsHere"
          :open-weights="openWeights"
          :added
          :locale
        />
      </div>
    </div>
  </div>
</template>
