<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import {
  computed,
  defineAsyncComponent,
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
import type { ModelTab } from '@/lib/workshop/explorer/model-tabs'
import {
  hostedInTab,
  tabForUseCases,
  tabUseCases,
  useCasesInTab
} from '@/lib/workshop/explorer/model-tabs'
import { modelTabCounts } from '@/lib/workshop/explorer/model-tab-counts'
import { useModelTab } from '@/lib/workshop/explorer/model-tab-address'
import { rememberListOnClick } from '@/lib/workshop/shelf-memory'
import { modelsListReturn } from '@/lib/workshop/models-list-return'
import { MODELS_CATALOGUE_ID } from '@/lib/workshop/models-hub'
import { shelfOf } from '@/lib/workshop/shelf-use-cases'
import { sectionTitleKeyFor } from '@/lib/workshop/section-title'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import BestForMenu from '@/components/workshop/models-hub/BestForMenu.vue'
import ResolutionMenu from '@/components/workshop/models-hub/ResolutionMenu.vue'
import type { Resolution } from '@/lib/workshop/resolution'
import {
  parseResolution,
  RESOLUTION_PARAM,
  RESOLUTIONS
} from '@/lib/workshop/resolution'
import { USE_CASE_PARAM, parseUseCases } from '@/lib/workshop/use-case-address'
import WorkshopModelsEmpty from '@/components/workshop/WorkshopModelsEmpty.vue'
import WorkshopModelsResults from '@/components/workshop/WorkshopModelsResults.vue'
import CompareTray from '@/components/workshop/explorer/compare/CompareTray.vue'
import ModelTabs from '@/components/workshop/explorer/ModelTabs.vue'
import ModelsExploreHero from '@/components/workshop/models-hub/ModelsExploreHero.vue'
import CatalogueShowMore from './CatalogueShowMore.vue'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSortMenu from './WorkshopSortMenu.vue'

const CompareView = defineAsyncComponent(
  () => import('@/components/workshop/explorer/compare/CompareView.vue')
)

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
const selectedResolution = ref<Resolution>()
const legacyModalities = ref<string[]>([])
const legacyProviders = ref<string[]>([])
const legacyCapabilities = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const tabCounts = computed(() => modelTabCounts(models))
const { tab, readAddress: readTab } = useModelTab(
  (named) => (tabCounts.value.get(named) ?? 0) > 0
)
const TAB_PANEL_ID = 'workshop-model-tab-panel'
const MODELS_PAGE_SIZE = 48
const openedShelf = computed(() => shelfOf(selectedUseCases.value))
let scrollReady = false

function readAddress(search: string) {
  const initial = parseCatalogSearch(search)
  query.value = initial.query ?? ''
  const opened = parseUseCases(search)
  readTab(search)
  const implied = tabForUseCases(opened, tab.value)
  if ((tabCounts.value.get(implied) ?? 0) > 0) tab.value = implied
  selectedUseCases.value =
    tab.value === 'all' ? opened : useCasesInTab(opened, tab.value)
  legacyModalities.value = [...initial.modalities]
  legacyProviders.value = [...initial.providers]
  legacyCapabilities.value = [...initial.capabilities]
  selectedAccess.value = parseAccess(search)
  selectedResolution.value = parseResolution(search)
}

function selectTab(next: ModelTab) {
  tab.value = next
  selectedUseCases.value =
    next === 'all' ? [] : useCasesInTab(selectedUseCases.value, next)
}

function writeParam(name: string, value: string) {
  const url = new URL(location.href)
  if (value) url.searchParams.set(name, value)
  else url.searchParams.delete(name)
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}
watch(selectedAccess, (value) => writeParam(ACCESS_PARAM, value.join(',')))
watch(selectedUseCases, (value) => writeParam(USE_CASE_PARAM, value.join(',')))
watch(selectedResolution, (value) => writeParam(RESOLUTION_PARAM, value ?? ''))

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
watch(compareOpen, () => window.scrollTo({ top: 0 }))

const toolbar = useTemplateRef<HTMLElement>('toolbar')
const heading = useTemplateRef<HTMLElement>('heading')

const useCaseOptions = computed<FacetMenuOption[]>(() => {
  const counts = countByUseCase(
    models.filter(
      (model) =>
        hostedInTab(model, tab.value) &&
        offersAccess(accessFor(model), selectedAccess.value)
    )
  )
  return (tabUseCases[tab.value] ?? [])
    .filter(({ useCase }) => counts[useCase] > 0)
    .map(({ useCase, labelKey }) => ({
      value: useCase,
      label: t(labelKey),
      count: counts[useCase]
    }))
})

watch(selectedUseCases, (selected) => {
  if (tab.value !== 'all') return
  const implied = tabForUseCases(selected, 'all')
  if (implied !== 'all' && (tabCounts.value.get(implied) ?? 0) > 0)
    tab.value = implied
})

watch(useCaseOptions, (options) => {
  if (tab.value === 'all') return
  const offered = selectedUseCases.value.filter((useCase) =>
    options.some((option) => option.value === useCase)
  )
  if (offered.length !== selectedUseCases.value.length)
    selectedUseCases.value = offered
})

const legacyFiltered = computed(
  () =>
    legacyModalities.value.length > 0 ||
    legacyProviders.value.length > 0 ||
    legacyCapabilities.value.length > 0
)

const inTab = computed(() =>
  searchWorkshopModels(models, {
    query: query.value,
    useCases: selectedUseCases.value,
    modalities: legacyModalities.value,
    providers: legacyProviders.value,
    capabilities: legacyCapabilities.value
  }).filter((model) => hostedInTab(model, tab.value))
)

// A way of using a model that every listed model offers narrows nothing, so
// it is only offered while it would change the list or is already chosen.
const accessOptions = computed<FacetMenuOption<ModelAccess>[]>(() =>
  MODEL_ACCESS.map((value) => ({
    value,
    label: t(accessFilterKey[value]),
    count: inTab.value.filter((model) => accessFor(model).includes(value))
      .length
  })).filter(
    (option) =>
      option.count < inTab.value.length ||
      selectedAccess.value.includes(option.value)
  )
)

const withAccess = computed(() =>
  inTab.value.filter((model) =>
    offersAccess(accessFor(model), selectedAccess.value)
  )
)
const resolutionOptions = computed<FacetMenuOption<Resolution>[]>(() =>
  RESOLUTIONS.map((value) => ({
    value,
    label: value,
    count: withAccess.value.filter((model) =>
      model.resolutions?.includes(value)
    ).length
  })).filter(
    (option) => option.count > 0 || option.value === selectedResolution.value
  )
)
const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      withAccess.value.filter(
        (model) =>
          !selectedResolution.value ||
          !!model.resolutions?.includes(selectedResolution.value)
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
    selectedResolution.value !== undefined ||
    tab.value !== 'all' ||
    legacyFiltered.value
)

const {
  limit: cardLimit,
  total: cardTotal,
  hasMore,
  showMore,
  shown: shownFamilies
} = usePagedList(() => visible.value, MODELS_PAGE_SIZE)

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
  selectedResolution.value = undefined
  tab.value = 'all'
  legacyModalities.value = []
  legacyProviders.value = []
  legacyCapabilities.value = []
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
  <section
    :class="cn('gap-10', comparedModels.length && !compareOpen && 'pb-24')"
  >
    <CompareView
      v-if="compareOpen"
      :models="comparedModels"
      toolbar
      removable
      :locale
      @remove="toggleCompare"
      @add="compareOpen = false"
    />
    <div v-else class="min-w-0">
      <ModelsExploreHero :models :locale />

      <!-- The sidebar already names the list and its count, so the heading is
        for assistive technology only. -->
      <h2
        :id="MODELS_CATALOGUE_ID"
        ref="heading"
        class="sr-only scroll-mt-24 lg:scroll-mt-32"
      >
        {{ t(sectionTitleKey) }}
        {{ resultCount }}
      </h2>

      <div class="flex flex-col lg:flex-row lg:items-start lg:gap-10">
        <div class="max-lg:contents lg:sticky lg:top-26 lg:w-58 lg:shrink-0">
          <ModelTabs
            :model-value="tab"
            :panel-id="TAB_PANEL_ID"
            :counts="tabCounts"
            :locale
            class="max-lg:order-1"
            data-design-decision="models-sidebar"
            @update:model-value="selectTab"
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
            class="sticky top-20 z-30 -mx-1 mb-8 flex scroll-mt-20 flex-wrap items-center gap-2 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26 lg:scroll-mt-26"
          >
            <WorkshopSearchField
              v-model="query"
              :models
              :locale
              compact
              class="min-w-0 flex-1 sm:min-w-48"
            />

            <div
              class="flex items-center gap-2 max-sm:order-last max-sm:-mx-1 max-sm:basis-full max-sm:overflow-x-auto max-sm:px-1"
              data-testid="workshop-dropdowns"
            >
              <BestForMenu
                v-if="useCaseOptions.length"
                v-model="selectedUseCases"
                :options="useCaseOptions"
                :locale
                data-design-decision="models-filters"
              />
              <ResolutionMenu
                v-if="resolutionOptions.length"
                v-model="selectedResolution"
                :options="resolutionOptions"
                :locale
              />
            </div>

            <div class="flex items-center gap-2" data-testid="workshop-filters">
              <WorkshopFilterMenu
                v-if="accessOptions.length"
                v-model:access="selectedAccess"
                :access-options="accessOptions"
                :result-count
                :locale
              />

              <WorkshopSortMenu v-model="sort" :orders="SORT_ORDERS" :locale />
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
    </div>

    <CompareTray
      v-if="comparedModels.length && !compareOpen"
      :models="comparedModels"
      :locale
      @remove="toggleCompare"
      @clear="clearCompare"
      @compare="compareOpen = true"
    />
  </section>
</template>
