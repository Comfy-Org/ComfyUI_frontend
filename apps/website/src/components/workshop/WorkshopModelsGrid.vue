<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
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
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import {
  ACCESS_PARAM,
  accessFilterKey,
  accessFor,
  MODEL_ACCESS,
  OPEN_WEIGHT_ACCESS,
  offersAccess,
  parseAccess
} from '@/lib/workshop/explorer/model-access'
import { useCompareSelection } from '@/lib/workshop/explorer/compare-selection'
import {
  filterOpenWeightModels,
  OPEN_WEIGHT_MODELS
} from '@/lib/workshop/explorer/open-weight-models'
import { hostedInTab } from '@/lib/workshop/explorer/model-tabs'
import { useModelTab } from '@/lib/workshop/explorer/model-tab-address'
import { rememberListOnClick } from '@/lib/workshop/shelf-memory'
import { modelsListReturn } from '@/lib/workshop/models-list-return'
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
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSections from './WorkshopSections.vue'
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
const { tab, readAddress: readTab } = useModelTab()
const TAB_PANEL_ID = 'workshop-model-tab-panel'
const openedShelf = computed(() => shelfOf(selectedUseCases.value))
// Willie's browseable listing: rows per use case until the visitor narrows
// down, then the flat grid takes over.
const browseAll = defineModel<boolean>('browseAll', { default: false })
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
  browseAll.value = false
  readAddress(location.search)
}

onMounted(() => {
  readAddress(initialSearch ?? location.search)
  window.addEventListener('pageshow', onPageShow)
  void nextTick(() => {
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
    count: OPEN_WEIGHT_ACCESS.includes(value)
      ? OPEN_WEIGHT_MODELS.length
      : models.filter((model) => accessFor(model).includes(value)).length
  }))
)

const legacyFiltered = computed(
  () =>
    legacyModalities.value.length > 0 ||
    legacyProviders.value.length > 0 ||
    legacyCapabilities.value.length > 0
)

const openWeightVisible = computed(() =>
  offersAccess(OPEN_WEIGHT_ACCESS, selectedAccess.value) &&
  !legacyFiltered.value
    ? filterOpenWeightModels(OPEN_WEIGHT_MODELS, {
        query: query.value,
        useCases: selectedUseCases.value,
        tab: tab.value,
        downloads: selectedAccess.value.includes('download'),
        byName: sort.value === 'name'
      })
    : []
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
const resultCount = computed(
  () => visible.value.length + openWeightVisible.value.length
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    selectedUseCases.value.length > 0 ||
    selectedAccess.value.length > 0 ||
    tab.value !== 'all' ||
    legacyFiltered.value
)

watch(
  [openedShelf, browseAll, () => query.value.trim() !== ''],
  ([nextShelf, nextBrowse], [previousShelf, previousBrowse]) => {
    if (!scrollReady) return
    const sectionChanged =
      nextShelf !== previousShelf || nextBrowse !== previousBrowse
    void nextTick(() => {
      if (sectionChanged) window.scrollTo({ top: 0 })
      else (heading.value ?? toolbar.value)?.scrollIntoView({ block: 'start' })
    })
  }
)
const browsing = computed(
  () => !isFiltered.value && !browseAll.value && sort.value === 'popular'
)
const inSection = computed(
  () => selectedUseCases.value.length > 0 || browseAll.value
)

const sectionTitleKey = computed<TranslationKey>(() =>
  sectionTitleKeyFor(selectedUseCases.value)
)

// A category names the screen it opens, so the page heading above it would say
// the catalogue's name twice.
const emit = defineEmits<{ section: [boolean]; hero: [boolean] }>()
watch(inSection, (value) => emit('section', value), { immediate: true })
watch(browsing, (value) => emit('hero', value), { immediate: true })

function leaveSection() {
  clearFilters()
}

function resetFilters() {
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

function clearFilters() {
  browseAll.value = false
  resetFilters()
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

watch(browseAll, (on) => on && resetFilters())
</script>

<template>
  <section :class="cn('gap-10', comparedModels.length && 'pb-24')">
    <div class="min-w-0">
      <button
        v-if="inSection"
        type="button"
        class="-ml-2.5 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-back"
        @click="leaveSection"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back') }}
      </button>

      <ModelsExploreHero v-if="browsing" :models :locale />

      <!-- scroll-mt tracks the nav height; the toolbar's is lower because its py-4 absorbs the difference -->
      <h2
        v-if="inSection"
        ref="heading"
        class="mt-5 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ t(sectionTitleKey) }}
        <span class="text-base font-normal text-primary-warm-gray tabular-nums">
          {{ resultCount }}
        </span>
      </h2>

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

          <div class="flex items-center gap-2" data-testid="workshop-filters">
            <WorkshopFilterMenu
              v-model:access="selectedAccess"
              :use-cases="selectedUseCases"
              :use-case-options="useCaseOptions"
              :access-options="accessOptions"
              :result-count
              :locale
              @update:use-cases="applyUseCases"
            />

            <WorkshopSortMenu v-model="sort" :orders="SORT_ORDERS" :locale />
          </div>
        </div>
      </div>

      <ModelTabs v-model="tab" :panel-id="TAB_PANEL_ID" :locale />

      <div
        :id="TAB_PANEL_ID"
        role="tabpanel"
        :aria-labelledby="`${TAB_PANEL_ID}-${tab}`"
      >
        <div
          v-if="browsing"
          class="flex flex-col gap-14 max-sm:gap-10"
          data-testid="workshop-sections"
        >
          <WorkshopSections
            :models
            :compared="comparedSlugs"
            :locale
            @browse="browseAll = true"
            @compare="toggleCompare"
          />
          <ModelAccessSection :locale />
          <ModelFamilySection :models :locale />
        </div>

        <template v-else>
          <WorkshopModelsResults
            v-if="resultCount"
            :families="visible"
            :open-weight="openWeightVisible"
            :compared="comparedSlugs"
            :locale
            @open="rememberModel"
            @compare="toggleCompare"
          />
          <WorkshopModelsEmpty
            v-else
            :filtered="isFiltered"
            :locale
            @clear="clearFilters"
          />
        </template>
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
