<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import CatalogueTabs from './CatalogueTabs.vue'
import type { CatalogueTab } from './CatalogueTabs.vue'
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
    if (!tab || tab === 'apps' || viewedTabs.has(tab)) return
    viewedTabs.add(tab)
    captureWorkshopEvent({
      name: 'catalogue_viewed',
      properties: {
        model_count:
          tab === 'models' ? routerModels.value.length : workflows.value.length,
        page_type: tab === 'models' ? 'model' : 'workflow'
      }
    })
  }
)
</script>

<template>
  <WorkshopHero
    v-if="!inSection"
    :eyebrow="t('workshop.catalogue.eyebrow', locale)"
    :heading="t('workshop.hero.heading', locale)"
    :subtitle="
      t(
        activeTab === 'models'
          ? 'workshop.hero.subtitle'
          : 'workshop.catalogue.subtitle',
        locale
      )
    "
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
