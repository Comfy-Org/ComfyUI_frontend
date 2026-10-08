<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { groupModels } from '@/config/model-family'
import { getRoutes } from '@/config/routes'

import type {
  SortOrder,
  UseCase,
  WorkshopModel
} from '@/config/models-catalogue'
import {
  parseCatalogSearch,
  SORT_ORDERS,
  USE_CASES,
  countByUseCase,
  sortWorkshopModels
} from '@/config/models-catalogue'
import { searchWorkshopModels } from '@/config/models-search'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { usePagedList } from '@/composables/usePagedList'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import {
  ACCESS_PARAM,
  accessFilterKey,
  accessFor,
  MODEL_ACCESS,
  offersAccess,
  parseAccess
} from '@/lib/workshop/explorer/model-access'
import { useCompareSelection } from '@/lib/workshop/explorer/compare-selection'
import { hostedInTab } from '@/lib/workshop/explorer/model-tabs'
import { modelTabCounts } from '@/lib/workshop/explorer/model-tab-counts'
import { useModelTab } from '@/lib/workshop/explorer/model-tab-address'
import { rememberListOnClick } from '@/lib/workshop/shelf-memory'
import { modelsListReturn } from '@/lib/workshop/models-list-return'
import { MODELS_CATALOGUE_ID } from '@/lib/workshop/models-hub'
import { openedUseCases, shelfOf } from '@/lib/workshop/shelf-use-cases'
import { sectionTitleKeyFor } from '@/lib/workshop/section-title'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelsEmpty from '@/components/workshop/WorkshopModelsEmpty.vue'
import WorkshopModelsResults from '@/components/workshop/WorkshopModelsResults.vue'
import CompareDialog from '@/components/workshop/explorer/compare/CompareDialog.vue'
import CompareTray from '@/components/workshop/explorer/compare/CompareTray.vue'
import ModelTabs from '@/components/workshop/explorer/ModelTabs.vue'
import ModelAccessSection from '@/components/workshop/models-hub/ModelAccessSection.vue'
import ModelFamilySection from '@/components/workshop/models-hub/ModelFamilySection.vue'
import ModelsExploreHero from '@/components/workshop/models-hub/ModelsExploreHero.vue'
import CatalogueShowMore from './CatalogueShowMore.vue'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSortMenu from './WorkshopSortMenu.vue'

const {
  models,
  initialSearch,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  initialSearch?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const query = ref('')
const selectedUseCases = ref<UseCase[]>([])
const selectedAccess = ref<ModelAccess[]>([])
const legacyModalities = ref<string[]>([])
const legacyProviders = ref<string[]>([])
const legacyCapabilities = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const tabCounts = computed(() => modelTabCounts(models))
const { tab, readAddress: readTab } = useModelTab(
  (named) => (tabCounts.value.get(named) ?? 0) > 0
)
const TAB_PANEL_ID = 'workshop-model-tab-panel'
const openedShelf = computed(() => shelfOf(selectedUseCases.value))
let scrollReady = false

function readAddress(search: string) {
  const initial = parseCatalogSearch(search)
  query.value = initial.query ?? ''
  selectedUseCases.value = openedUseCases(initial.useCase ?? 'all')
  legacyModalities.value = [...initial.modalities]
  legacyProviders.value = [...initial.providers]
  legacyCapabilities.value = [...initial.capabilities]
  selectedAccess.value = parseAccess(search)
  readTab(search)
}

watch(selectedAccess, (value) => {
  const url = new URL(location.href)
  if (value.length) url.searchParams.set(ACCESS_PARAM, value.join(','))
  else url.searchParams.delete(ACCESS_PARAM)
  if (url.href !== location.href) history.replaceState(history.state, '', url)
})

// A browser can restore this page from its cache with a shelf still open, so
// coming back from a model would land on that shelf rather than on the
// catalogue the address names. The address is the truth on every show.
function onPageShow(event: PageTransitionEvent) {
  if (!event.persisted) return
  readAddress(location.search)
}

onMounted(() => {
  readAddress(initialSearch ?? location.search)
  window.addEventListener('pageshow', onPageShow)
  void nextTick(() => {
    if (isFiltered.value) heading.value?.scrollIntoView({ block: 'start' })
    scrollReady = true
  })
})
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))

const {
  slugs: comparedSlugs,
  chosen: comparedModels,
  open: compareOpen,
  toggle: toggleCompare,
  clear: clearCompare
} = useCompareSelection(() => models)

const toolbar = useTemplateRef<HTMLElement>('toolbar')
const heading = useTemplateRef<HTMLElement>('heading')

const useCaseOptions = computed<FacetMenuOption[]>(() => {
  const counts = countByUseCase(models)
  return USE_CASES.filter((value) => counts[value] > 0).map((value) => ({
    value,
    label: t(useCaseLabelKey[value]),
    count: counts[value]
  }))
})

const accessOptions = computed<FacetMenuOption<ModelAccess>[]>(() =>
  MODEL_ACCESS.map((value) => ({
    value,
    label: t(accessFilterKey[value]),
    count: models.filter((model) => accessFor(model).includes(value)).length
  }))
)

const legacyFiltered = computed(
  () =>
    legacyModalities.value.length > 0 ||
    legacyProviders.value.length > 0 ||
    legacyCapabilities.value.length > 0
)

const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      searchWorkshopModels(models, {
        query: query.value,
        useCases: selectedUseCases.value,
        modalities: legacyModalities.value,
        providers: legacyProviders.value,
        capabilities: legacyCapabilities.value
      }).filter(
        (model) =>
          hostedInTab(model, tab.value) &&
          offersAccess(accessFor(model), selectedAccess.value)
      ),
      sort.value
    )
  )
)
const resultCount = computed(() => visible.value.length)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    selectedUseCases.value.length > 0 ||
    selectedAccess.value.length > 0 ||
    tab.value !== 'all' ||
    legacyFiltered.value
)

const {
  limit: cardLimit,
  total: cardTotal,
  hasMore,
  showMore,
  shown: shownFamilies
} = usePagedList(() => visible.value)

watch([openedShelf, () => query.value.trim() !== ''], () => {
  if (!scrollReady) return
  void nextTick(() =>
    (heading.value ?? toolbar.value)?.scrollIntoView({ block: 'start' })
  )
})

const sectionTitleKey = computed<TranslationKey>(() =>
  sectionTitleKeyFor(selectedUseCases.value, tab.value)
)

function clearFilters() {
  query.value = ''
  selectedUseCases.value = []
  selectedAccess.value = []
  tab.value = 'all'
  legacyModalities.value = []
  legacyProviders.value = []
  legacyCapabilities.value = []
}

function applyUseCases(values: UseCase[]) {
  selectedUseCases.value = values
}

function rememberModel(model: WorkshopModel, event: MouseEvent) {
  if (!model.href) return
  const list = modelsListReturn(
    {
      query: query.value,
      useCases: selectedUseCases.value,
      tab: tab.value,
      access: selectedAccess.value
    },
    locale
  )
  rememberListOnClick(list, model.href, event)
}
</script>

<template>
  <section :class="cn('gap-10', comparedModels.length && 'pb-24')">
    <div class="min-w-0">
      <ModelsExploreHero :models :locale />

      <!-- scroll-mt tracks the nav height; the toolbar's is lower because its py-4 absorbs the difference -->
      <h2
        :id="MODELS_CATALOGUE_ID"
        ref="heading"
        class="mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ t(sectionTitleKey) }}
        <span class="text-base font-normal text-primary-warm-gray tabular-nums">
          {{ resultCount }}
        </span>
      </h2>

      <div class="flex flex-col lg:flex-row lg:items-start lg:gap-10">
        <div class="max-lg:contents lg:sticky lg:top-26 lg:w-58 lg:shrink-0">
          <ModelTabs
            v-model="tab"
            :panel-id="TAB_PANEL_ID"
            :counts="tabCounts"
            :locale
            class="max-lg:order-1"
          />
          <a
            :href="getRoutes(locale).models"
            class="mt-6 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary-comfy-yellow transition-opacity outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-lg:order-3 lg:px-3"
            data-testid="models-all-link"
          >
            {{ t('workshop.explorer.allModelsLink') }}
            <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
          </a>
        </div>

        <div class="min-w-0 max-lg:contents lg:flex-1">
          <div
            :id="HUB_TOOLBAR_ID"
            ref="toolbar"
            data-testid="workshop-toolbar"
            class="sticky top-20 z-30 -mx-1 mb-8 flex scroll-mt-20 flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26 lg:scroll-mt-26"
          >
            <div
              class="flex min-w-0 flex-1 items-center gap-3 max-sm:basis-full sm:min-w-fit"
            >
              <WorkshopSearchField
                v-model="query"
                :models
                :locale
                compact
                class="min-w-0 flex-1"
              />

              <div
                class="flex items-center gap-2"
                data-testid="workshop-filters"
              >
                <WorkshopFilterMenu
                  v-model:access="selectedAccess"
                  :use-cases="selectedUseCases"
                  :use-case-options="useCaseOptions"
                  :access-options="accessOptions"
                  :result-count
                  :locale
                  @update:use-cases="applyUseCases"
                />

                <WorkshopSortMenu
                  v-model="sort"
                  :orders="SORT_ORDERS"
                  :locale
                />
              </div>
            </div>
          </div>

          <div
            :id="TAB_PANEL_ID"
            role="tabpanel"
            :aria-labelledby="`${TAB_PANEL_ID}-${tab}`"
            class="max-lg:order-2"
          >
            <template v-if="resultCount">
              <WorkshopModelsResults
                :families="shownFamilies"
                :compared="comparedSlugs"
                :locale
                @open="rememberModel"
                @compare="toggleCompare"
              />
              <CatalogueShowMore
                v-if="hasMore"
                :shown="cardLimit"
                :total="cardTotal"
                :locale
                @more="showMore"
              />
            </template>
            <WorkshopModelsEmpty
              v-else
              :filtered="isFiltered"
              :locale
              @clear="clearFilters"
            />
          </div>
        </div>
      </div>

      <div
        class="mt-20 flex flex-col gap-14 max-sm:mt-14 max-sm:gap-10"
        data-testid="models-hub-more"
      >
        <ModelAccessSection :locale />
        <ModelFamilySection :models :locale />
      </div>
    </div>

    <CompareTray
      v-if="comparedModels.length"
      :models="comparedModels"
      :locale
      @remove="toggleCompare"
      @clear="clearCompare"
      @compare="compareOpen = true"
    />
    <CompareDialog
      v-model:open="compareOpen"
      :models="comparedModels"
      :locale
    />
  </section>
</template>
