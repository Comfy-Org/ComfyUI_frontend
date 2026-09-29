<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import CatalogueTabs from './CatalogueTabs.vue'
import type { CatalogueTab } from './CatalogueTabs.vue'
import type { WorkshopPageType } from '../../scripts/workshop-analytics'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '../../scripts/posthog'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'

const WorkflowCatalogue = defineAsyncComponent(
  () => import('./WorkflowCatalogue.vue')
)
const AppCatalogue = defineAsyncComponent(() => import('./AppCatalogue.vue'))

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const inSection = ref(false)
const browseAll = ref(false)
const mounted = useMounted()
const enabled = useWorkshopEnabled()
const appsEnabled = useWorkshopAppsEnabled()
const selectedTab = ref<CatalogueTab>('models')
if (typeof location !== 'undefined') {
  const requested = new URLSearchParams(location.search).get('type')
  if (requested === 'workflows' || requested === 'workflow') {
    selectedTab.value = 'workflows'
    void import('./WorkflowCatalogue.vue').catch(() => undefined)
  }
  if (requested === 'apps') selectedTab.value = 'apps'
}
const routerModels = computed(() =>
  models.filter((model) => model.routerId !== undefined)
)
const workflows = computed(() =>
  models.filter(
    (model): model is WorkflowWorkshopModel =>
      model.type === 'CLOUD' || model.type === 'SERVERLESS'
  )
)
const apps = computed(() =>
  models.filter((model): model is AppWorkshopModel => model.type === 'APP')
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
  availableTabs.value.includes(selectedTab.value) ? selectedTab.value : 'models'
)

// Each tab says what its own listing is for, in Eric's words.
const SUBTITLE_KEY = {
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<CatalogueTab, TranslationKey>
const subtitleKey = computed(() => SUBTITLE_KEY[activeTab.value])

const focusTabs = ref(false)
function changeTab(tab: CatalogueTab) {
  focusTabs.value = Boolean(
    document.activeElement?.closest('[data-testid="catalogue-tabs"]')
  )
  selectedTab.value = tab
  inSection.value = false
  browseAll.value = false
  const url = new URL(location.href)
  url.search = ''
  if (tab !== 'models') url.searchParams.set('type', tab)
  history.replaceState(history.state, '', url)
}

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
  <WorkshopHero
    v-if="!inSection"
    :eyebrow="t('workshop.catalogue.eyebrow', locale)"
    :heading="t('workshop.hero.heading', locale)"
    :subtitle="t(subtitleKey, locale)"
    :subtitle-space="availableTabs.map((tab) => t(SUBTITLE_KEY[tab], locale))"
  />
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
        :focus-active="focusTabs"
        @update:model-value="changeTab"
        @focused="focusTabs = false"
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
        :focus-active="focusTabs"
        @update:model-value="changeTab"
        @focused="focusTabs = false"
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
        :focus-active="focusTabs"
        @update:model-value="changeTab"
        @focused="focusTabs = false"
      />
    </template>
  </AppCatalogue>
</template>
