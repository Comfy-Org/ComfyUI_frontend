<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useMounted, whenever } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
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

const WorkflowCatalogue = defineAsyncComponent(loadWorkflowCatalogue)
const AppCatalogue = defineAsyncComponent(loadAppCatalogue)

const {
  models,
  initialSearch,
  locale = 'en',
  section = 'models'
} = defineProps<{
  models: readonly WorkshopModel[]
  initialSearch?: string
  locale?: Locale
  section?: CatalogueTab
}>()
const { t } = translationsFor(locale)

const inSection = ref(false)
// A category replaces the page's own heading and the switch between
// catalogues, so the state has to reach the page that renders them.
const emit = defineEmits<{ section: [boolean] }>()
watch(inSection, (value) => emit('section', value), { immediate: true })
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
    thumbnail: app.thumbnail
  }))
)
const availableTabs = computed<readonly CatalogueTab[]>(() => [
  'models',
  ...(workflows.value.length || section === 'workflows'
    ? (['workflows'] as const)
    : []),
  ...((appsEnabled.value && apps.value.length) || section === 'apps'
    ? (['apps'] as const)
    : [])
])

// Each tab says what its own listing is for, in Eric's words.
const SUBTITLE_KEY = {
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<CatalogueTab, TranslationKey>

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
        {{ t(subtitle) }}
      </p>
    </div>
  </div>
  <WorkshopModelsGrid
    v-if="section === 'models'"
    v-model:browse-all="browseAll"
    :models="routerModels"
    :initial-search
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="availableTabs.length > 1 && !inSection"
        :tabs="availableTabs"
        :model-value="section"
        :locale
        links
      />
    </template>
  </WorkshopModelsGrid>
  <WorkflowCatalogue
    v-else-if="section === 'workflows'"
    v-model:browse-all="browseAll"
    :models="workflows"
    :initial-search
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="!inSection"
        :tabs="availableTabs"
        :model-value="section"
        :locale
        links
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
        v-if="!inSection"
        :tabs="availableTabs"
        :model-value="section"
        :locale
        links
      />
    </template>
  </AppCatalogue>
</template>
