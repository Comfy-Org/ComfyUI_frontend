<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import WorkflowActions from './WorkflowActions.vue'
import WorkflowDetails from './WorkflowDetails.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowHowItWorks from './WorkflowHowItWorks.vue'

interface Tag {
  readonly label: string
  readonly href: string
}

const {
  graphUrl,
  cloudUrl,
  runsHere,
  tutorialUrl,
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
      <section data-testid="workflow-graph-section">
        <h2 :class="sectionTitle">
          {{ t('workshop.v2.workflow.graph', locale) }}
        </h2>
        <p class="mt-2 mb-4 text-sm text-content-muted">
          {{ t('workshop.v2.workflow.graphNote', locale) }}
        </p>
        <WorkflowGraph :source="graphUrl" :locale />
      </section>

      <section>
        <h2 :class="sectionTitle">
          {{ t('workshop.v2.workflow.takeaways', locale) }}
        </h2>
        <div class="mt-4">
          <WorkflowActions
            :cloud-url="cloudUrl"
            :runs-here="runsHere"
            :download-url="graphUrl"
            :tutorial-url="tutorialUrl"
            :locale
          />
        </div>
      </section>
    </div>

    <div class="lg:col-span-4">
      <div class="flex flex-col gap-10 lg:sticky lg:top-28">
        <WorkflowHowItWorks :models :locale />

        <WorkflowDetails
          :author
          :usage
          :produces
          :runs-here="runsHere"
          :added
          :locale
        />

        <section v-if="tags.length > 0">
          <h2 :class="sectionTitle">
            {{ t('workshop.v2.workflow.tags', locale) }}
          </h2>
          <ul class="mt-3 flex flex-wrap gap-2" data-testid="workflow-tags">
            <li v-for="tag in tags" :key="tag.href">
              <a
                :href="tag.href"
                class="inline-flex h-7 items-center rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
              >
                {{ tag.label }}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
