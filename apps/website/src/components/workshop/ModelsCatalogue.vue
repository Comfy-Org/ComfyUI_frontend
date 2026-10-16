<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  inject,
  onScopeDispose,
  ref,
  watch
} from 'vue'
import { useMounted, whenever } from '@vueuse/core'
import CatalogueIntroduction from './CatalogueIntroduction.vue'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import CatalogueTabs from './CatalogueTabs.vue'
import type { CatalogueTab } from './CatalogueTabs.vue'
import type { WorkshopPageType } from '@/scripts/workshop-analytics'
import {
  captureWorkshopEvent,
  useWorkshopAppsEnabled,
  useWorkshopEnabled
} from '@/scripts/posthog'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import {
  loadAppCatalogue,
  loadWorkflowCatalogue
} from '@/lib/workshop/catalogue-components'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import { cccCatalogueComponents } from './ccc-catalogue-components'
import CatalogPagination from './CatalogPagination.vue'
import type {
  CatalogListPages,
  CatalogListFacets
} from '@/lib/cms/catalog-list'

const suppliedComponents = inject(cccCatalogueComponents, undefined)
const WorkflowCatalogue =
  suppliedComponents?.workflows ?? defineAsyncComponent(loadWorkflowCatalogue)
const AppCatalogue =
  suppliedComponents?.apps ?? defineAsyncComponent(loadAppCatalogue)

const {
  models,
  initialSearch,
  locale = 'en',
  section = 'models',
  optimisticNavigation = false,
  pages,
  facets
} = defineProps<{
  models: readonly WorkshopModel[]
  initialSearch?: string
  locale?: Locale
  section?: CatalogueTab
  optimisticNavigation?: boolean
  pages?: CatalogListPages
  facets?: CatalogListFacets
}>()

const inSection = ref(false)
// A category replaces the page's own heading and the switch between
// catalogues, so the state has to reach the page that renders them.
const emit = defineEmits<{
  section: [boolean]
  displayedSection: [CatalogueTab]
  search: [string]
  page: [string]
}>()
watch(inSection, (value) => emit('section', value), { immediate: true })
function paginatedBrowse() {
  const page = new URLSearchParams(initialSearch).get('p') ?? ''
  return Boolean(
    pages && /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page))
  )
}
const browseAll = ref(paginatedBrowse())
watch([() => initialSearch, () => Boolean(pages)], () => {
  browseAll.value = paginatedBrowse()
})
const mounted = useMounted()
const intendedSection = ref<CatalogueTab>()
const displayedSection = computed(() => intendedSection.value ?? section)
let rollback: ReturnType<typeof setTimeout> | undefined
function resetNavigation() {
  clearTimeout(rollback)
  intendedSection.value = undefined
}
function navigate(tab: CatalogueTab) {
  if (!optimisticNavigation || tab === displayedSection.value) return
  resetNavigation()
  browseAll.value = false
  inSection.value = false
  intendedSection.value = tab
  rollback = setTimeout(resetNavigation, 5_000)
}
watch(
  [() => section, () => models, () => optimisticNavigation],
  resetNavigation
)
watch(displayedSection, (value) => emit('displayedSection', value), {
  immediate: true
})
onScopeDispose(resetNavigation)
whenever(
  () => mounted.value && optimisticNavigation && !suppliedComponents,
  () => {
    void Promise.allSettled([loadWorkflowCatalogue(), loadAppCatalogue()])
  },
  { once: true }
)
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
    thumbnail: app.thumbnail
  }))
)
const workflowsAvailable = computed(
  () =>
    Boolean(
      pages?.workflows.available ??
      pages?.workflows.total ??
      workflows.value.length
    ) || displayedSection.value === 'workflows'
)
const appsAvailable = computed(
  () =>
    (appsEnabled.value &&
      Boolean(
        pages?.apps.available ?? pages?.apps.total ?? apps.value.length
      )) ||
    section === 'apps'
)
const availableTabs = computed<readonly CatalogueTab[]>(() => [
  'models',
  ...(workflowsAvailable.value ? (['workflows'] as const) : []),
  ...(appsAvailable.value ? (['apps'] as const) : [])
])

whenever(
  () => mounted.value && enabled.value,
  () => {
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
      properties: catalogues[section]
    })
  },
  { once: true }
)
</script>

<template>
  <CatalogueIntroduction
    v-if="!inSection"
    :displayed-section="displayedSection"
    :locale
  />
  <WorkshopModelsGrid
    v-if="displayedSection === 'models'"
    v-model:browse-all="browseAll"
    :models="routerModels"
    :server-page="pages?.models"
    :server-facets="facets?.models"
    :initial-search
    :locale
    @search="emit('search', $event)"
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="availableTabs.length > 1 && !inSection"
        :tabs="availableTabs"
        :model-value="displayedSection"
        :locale
        links
        :locale-links="optimisticNavigation"
        @navigate="navigate"
      />
    </template>
  </WorkshopModelsGrid>
  <WorkflowCatalogue
    v-else-if="displayedSection === 'workflows'"
    v-model:browse-all="browseAll"
    :models="workflows"
    :server-page="pages?.workflows"
    :server-facets="facets?.workflows"
    :initial-search
    :locale
    @search="emit('search', $event)"
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="!inSection"
        :tabs="availableTabs"
        :model-value="displayedSection"
        :locale
        links
        :locale-links="optimisticNavigation"
        @navigate="navigate"
      />
    </template>
  </WorkflowCatalogue>
  <AppCatalogue
    v-else
    v-model:browse-all="browseAll"
    :apps="appCards"
    :initial-search
    :server-page="pages?.apps"
    :locale
    @section="inSection = $event"
    @search="emit('search', $event)"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="!inSection"
        :tabs="availableTabs"
        :model-value="displayedSection"
        :locale
        links
        :locale-links="optimisticNavigation"
        @navigate="navigate"
      />
    </template>
  </AppCatalogue>
  <CatalogPagination
    v-if="pages"
    :page="pages[displayedSection]"
    :section="displayedSection"
    :initial-search="displayedSection === section ? initialSearch : undefined"
    :locale
    @navigate="emit('page', $event)"
  />
</template>
