<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'
import WorkshopModelsGrid from './WorkshopModelsGrid.vue'
import CatalogueTabs from './CatalogueTabs.vue'
import type { CatalogueTab } from './CatalogueTabs.vue'
import { captureWorkshopEvent, useWorkshopEnabled } from '../../scripts/posthog'

const WorkflowCatalogue = defineAsyncComponent(
  () => import('./WorkflowCatalogue.vue')
)

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const inSection = ref(false)
const browseAll = ref(false)
const mounted = useMounted()
const enabled = useWorkshopEnabled()
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
  models.filter((model) => model.routerId === undefined)
)
const heroSubtitle = {
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<CatalogueTab, TranslationKey>
const activeTab = computed(() =>
  workflows.value.length ? selectedTab.value : 'models'
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
    :eyebrow="t('workshop.hero.eyebrow', locale)"
    :heading="t('workshop.hero.heading', locale)"
    :subtitle="t(heroSubtitle[activeTab], locale)"
  >
    <template #aside>
      <button
        v-if="activeTab !== 'apps'"
        type="button"
        class="group -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1 text-xl font-medium text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="browse-all"
        @click="browseAll = true"
      >
        {{
          t(
            activeTab === 'models'
              ? 'workshop.sections.browseAll'
              : 'workshop.catalogue.browseAllWorkflows',
            locale
          )
        }}
        <ChevronRight
          class="size-5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </template>
  </WorkshopHero>
  <WorkshopModelsGrid
    v-if="activeTab === 'models'"
    v-model:browse-all="browseAll"
    :models="routerModels"
    :locale
    @section="inSection = $event"
  >
    <template #tabs>
      <CatalogueTabs
        v-if="workflows.length"
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
        :model-value="activeTab"
        :locale
        :focus-active="focusTabs"
        @update:model-value="changeTab"
        @focused="focusTabs = false"
      />
    </template>
  </WorkflowCatalogue>
  <section v-else data-testid="apps-catalogue">
    <!-- Apps has no list of its own yet, so the tabs bring their own bar
      rather than leaving this half with no way back. -->
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="workshop-toolbar"
    >
      <CatalogueTabs
        :model-value="activeTab"
        :locale
        :focus-active="focusTabs"
        @update:model-value="changeTab"
        @focused="focusTabs = false"
      />
    </div>
    <div class="rounded-3xl bg-hub-surface p-8">
      <h2 class="text-xl font-medium text-primary-comfy-canvas">
        {{ t('workshop.catalogue.appsSoon', locale) }}
      </h2>
      <p class="mt-3 max-w-2xl text-content-secondary">
        {{ t('workshop.catalogue.appsHint', locale) }}
      </p>
    </div>
  </section>
</template>
