<script setup lang="ts">
import type {
  WorkshopModel,
  WorkshopModelDetail
} from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import ModelDetail from '../workshop/ModelDetail.vue'
import WorkflowAbout from './WorkflowAbout.vue'

// A workflow the Hub carries is one call to one model, so there is no
// operation to choose between and the playground stands on its own. What the
// graph adds rides in the tab the model page already has for it, which keeps
// the page to one row of tabs rather than one row per island.
const {
  model,
  locale = 'en',
  ...about
} = defineProps<{
  model: WorkshopModelDetail
  graphUrl: string
  cloudUrl: string
  runsHere: boolean
  tutorialUrl: string | undefined
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  author: string
  usage: number
  produces: readonly HubPortSummary[]
  openWeights: boolean
  added: string
  locale?: Locale
}>()
</script>

<template>
  <div data-testid="workflow-run">
    <ModelDetail :model :locale>
      <template #details>
        <WorkflowAbout v-bind="about" :locale />
      </template>
    </ModelDetail>
  </div>
</template>
