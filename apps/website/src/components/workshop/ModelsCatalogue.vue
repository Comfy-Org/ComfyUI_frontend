<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SplitReveal from './SplitReveal.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import CatalogueTabs from './CatalogueTabs.vue'
import type { CatalogueTab } from '../../lib/workshop/catalogue-tabs'
import type { WorkshopPageType } from '../../scripts/workshop-analytics'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '../../scripts/posthog'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'
import { isWorkshopModelShown } from '../../scripts/workshop-model-flags'

const WorkflowCatalogue = defineAsyncComponent(
  () => import('./WorkflowCatalogue.vue')
)
const AppCatalogue = defineAsyncComponent(() => import('./AppCatalogue.vue'))

const {
  models,
  locale = 'en',
  catalogueTab = 'models'
} = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
  catalogueTab?: CatalogueTab
}>()

const inSection = ref(false)
const browseAll = ref(false)
const mounted = useMounted()
const enabled = useWorkshopEnabled()
const appsEnabled = useWorkshopAppsEnabled()
const requestedTab =
  catalogueTab === 'models' && typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('type')
    : catalogueTab
const selectedTab: CatalogueTab =
  requestedTab === 'workflows' || requestedTab === 'workflow'
    ? 'workflows'
    : requestedTab === 'apps'
      ? 'apps'
      : 'models'
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
const availableTabs = computed<readonly CatalogueTab[]>(() => [
  'models',
  ...(workflows.value.length ? (['workflows'] as const) : []),
  ...(appsEnabled.value && apps.value.length ? (['apps'] as const) : [])
])
const activeTab = computed(() =>
  availableTabs.value.includes(selectedTab) ? selectedTab : 'models'
)
const catalogueHrefs = computed(() => {
  const routes = getRoutes(locale)
  return {
    models: routes.workshop,
    workflows: routes.workshopWorkflows,
    apps: routes.workshopApps
  }
})

// Each tab says what its own listing is for, in Eric's words.
const SUBTITLE_KEY = {
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<CatalogueTab, TranslationKey>
const subtitleKey = computed(() => SUBTITLE_KEY[activeTab.value])

const viewedTabs = new Set<CatalogueTab>()
watch(
  () => (mounted.value && enabled.value ? activeTab.value : undefined),
  (tab) => {
    if (!tab || viewedTabs.has(tab)) return
    viewedTabs.add(tab)
    const catalogues = {
      models: { model_count: routerModels.value.length, page_type: 'model' },
      workflows: { model_count: workflows.value.length, page_type: 'workflow' },
      apps: { model_count: apps.value.length, page_type: 'app' }
    } as const satisfies Record<
      CatalogueTab,
      { model_count: number; page_type: WorkshopPageType }
    >
    captureWorkshopEvent({
      name: 'catalogue_viewed',
      properties: catalogues[tab]
    })
  }
)
</script>

<template>
  <div
    v-if="!inSection"
    class="relative isolate -mx-6 mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden px-6 pb-2 max-sm:mb-4 max-sm:pb-0 lg:-mx-8 lg:px-8 sm:short:pb-0"
    data-testid="workshop-hero"
  >
    <p class="text-lg text-primary-comfy-canvas/70">
      <SplitReveal :text="t(subtitleKey, locale)" :delay="260" :stagger="50" />
    </p>
  </div>
  <WorkshopModelsGrid
    v-if="activeTab === 'models'"
    v-model:browse-all="browseAll"
    :models="routerModels"
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="availableTabs.length > 1"
        :tabs="availableTabs"
        :model-value="activeTab"
        :locale
        :hrefs="catalogueHrefs"
      />
    </template>
  </WorkshopModelsGrid>
  <WorkflowCatalogue
    v-else-if="activeTab === 'workflows'"
    v-model:browse-all="browseAll"
    :models="workflows"
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        :tabs="availableTabs"
        :model-value="activeTab"
        :locale
        :hrefs="catalogueHrefs"
      />
    </template>
  </WorkflowCatalogue>
  <AppCatalogue
    v-else
    v-model:browse-all="browseAll"
    :apps="appCards"
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        :tabs="availableTabs"
        :model-value="activeTab"
        :locale
        :hrefs="catalogueHrefs"
      />
    </template>
  </AppCatalogue>
</template>
