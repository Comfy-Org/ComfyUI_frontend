<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useMounted, whenever } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BuildApiBand from './BuildApiBand.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import type { HubSection } from '../../lib/workshop/hub-section'
import type { WorkshopPageType } from '../../scripts/workshop-analytics'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '../../scripts/posthog'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'
import {
  loadAppCatalogue,
  loadExploreCatalogue,
  loadWorkflowCatalogue
} from '../../lib/workshop/catalogue-components'
import { isWorkshopModelShown } from '../../scripts/workshop-model-flags'

const WorkflowCatalogue = defineAsyncComponent(loadWorkflowCatalogue)
const AppCatalogue = defineAsyncComponent(loadAppCatalogue)
const ExploreCatalogue = defineAsyncComponent(loadExploreCatalogue)

const {
  models,
  initialSearch,
  locale = 'en',
  section = 'models'
} = defineProps<{
  models: readonly WorkshopModel[]
  initialSearch?: string
  locale?: Locale
  section?: HubSection
}>()

const inSection = ref(false)
const browseAll = ref(false)
const mounted = useMounted()
const enabled = useWorkshopEnabled()
const appsEnabled = useWorkshopAppsEnabled()
const shownModels = computed(() =>
  models.filter((model) => isWorkshopModelShown(model))
)
const routerModels = computed(() =>
  shownModels.value.filter((model) => model.routerId !== undefined)
)
const workflows = computed(() =>
  shownModels.value.filter(
    (model): model is WorkflowWorkshopModel =>
      model.type === 'CLOUD' || model.type === 'SERVERLESS'
  )
)
const apps = computed(() =>
  shownModels.value.filter(
    (model): model is AppWorkshopModel => model.type === 'APP'
  )
)
const appCards = computed<readonly CatalogueApp[]>(() =>
  apps.value.map((app) => ({
    key: app.slug,
    name: app.name,
    task: ac(app.appId === 'studio' ? 'studioTask' : 'reshootTask', locale),
    href: app.href,
    image: app.thumbnail?.url ?? app.thumbnailUrl
  }))
)

// Each tab says what its own listing is for, in Eric's words.
const SUBTITLE_KEY = {
  explore: 'workshop.explore.subtitle',
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<HubSection, TranslationKey>

whenever(
  () => mounted.value && enabled.value,
  () => {
    const catalogues = {
      explore: {
        model_count:
          routerModels.value.length + workflows.value.length + apps.value.length
      },
      models: { model_count: routerModels.value.length, page_type: 'model' },
      workflows: { model_count: workflows.value.length, page_type: 'workflow' },
      apps: { model_count: apps.value.length, page_type: 'app' }
    } as const satisfies Record<
      HubSection,
      { model_count: number; page_type?: WorkshopPageType }
    >
    captureWorkshopEvent({
      name: 'catalogue_viewed',
      properties: catalogues[section]
    })
  },
  { once: true }
)
</script>

<template>
  <div
    v-if="!inSection"
    class="relative isolate -mx-6 mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden px-6 pb-2 max-sm:mb-4 max-sm:pb-0 lg:-mx-8 lg:px-8 sm:short:pb-0"
    data-testid="workshop-hero"
  >
    <div class="grid text-lg text-primary-comfy-canvas/70">
      <p
        v-for="(subtitle, tab) in SUBTITLE_KEY"
        :key="tab"
        :class="
          cn(
            'col-start-1 row-start-1',
            tab === section ? 'animate-soft-in' : 'invisible'
          )
        "
        :aria-hidden="tab !== section"
      >
        {{ t(subtitle, locale) }}
      </p>
    </div>
  </div>
  <ExploreCatalogue
    v-if="section === 'explore'"
    :apps="appsEnabled ? appCards : []"
    :workflows
    :models="routerModels"
    :locale
  />
  <template v-else-if="section === 'models'">
    <BuildApiBand v-if="!inSection" :locale />
    <WorkshopModelsGrid
      v-model:browse-all="browseAll"
      :models="routerModels"
      :initial-search
      :locale
      @section="inSection = $event"
    />
  </template>
  <WorkflowCatalogue
    v-else-if="section === 'workflows'"
    v-model:browse-all="browseAll"
    :models="workflows"
    :initial-search
    :locale
    @section="inSection = $event"
  />
  <AppCatalogue
    v-else
    v-model:browse-all="browseAll"
    :apps="appCards"
    :locale
    @section="inSection = $event"
  />
</template>
