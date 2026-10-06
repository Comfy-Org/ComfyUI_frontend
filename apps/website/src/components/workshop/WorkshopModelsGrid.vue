<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
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
  USE_CASES,
  countByUseCase,
  filterWorkshopModels,
  sortOrdersFor,
  sortWorkshopModels
} from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import {
  accessFilterKey,
  accessFor,
  MODEL_ACCESS,
  OPEN_WEIGHT_ACCESS,
  offersAccess
} from '@/lib/workshop/explorer/model-access'
import { useCompareSelection } from '@/lib/workshop/explorer/compare-selection'
import {
  filterOpenWeightModels,
  OPEN_WEIGHT_MODELS
} from '@/lib/workshop/explorer/open-weight-models'
import { hostedInTab } from '@/lib/workshop/explorer/model-tabs'
import { useModelTab } from '@/lib/workshop/explorer/model-tab-address'
import { rememberShelfOnClick } from '@/lib/workshop/shelf-memory'
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
import FeaturedBanner from './FeaturedBanner.vue'
import { modelSlides } from '@/lib/workshop/featured-slides'
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
  readTab(search)
}

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
const sortOrders = sortOrdersFor(models)

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
      filterWorkshopModels(models, {
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
const emit = defineEmits<{ section: [boolean] }>()
watch(inSection, (value) => emit('section', value), { immediate: true })

// Keep the launch-requested video models in the set, then let the same curated
// order used by the rows decide where every selected model appears.
const FEATURED_LIMIT = 6
const FEATURED_SLUGS = [
  'byteplus--seedance-2-fast-text-to-video--generate-videos'
]
const featured = computed(() => {
  const available = sortWorkshopModels(models, 'popular').filter(
    (model) => model.thumbnailUrl && !model.slug.startsWith('bfl--flux-3-')
  )
  const selected = FEATURED_SLUGS.flatMap((slug) =>
    available.filter((model) => model.slug === slug)
  )
  return sortWorkshopModels(
    [
      ...selected,
      ...available.filter((model) => !FEATURED_SLUGS.includes(model.slug))
    ].slice(0, FEATURED_LIMIT),
    'popular'
  )
})
const featuredSlides = computed(() => modelSlides(featured.value, locale))

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

function rememberModel(
  model: WorkshopModel,
  event: MouseEvent,
  shelf = openedShelf.value
) {
  if (model.href) rememberShelfOnClick(shelf, model.href, event)
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

            <WorkshopSortMenu v-model="sort" :orders="sortOrders" :locale />
          </div>
        </div>
      </div>

      <ModelTabs v-model="tab" :panel-id="TAB_PANEL_ID" :locale />

      <div
        :id="TAB_PANEL_ID"
        role="tabpanel"
        :aria-labelledby="`${TAB_PANEL_ID}-${tab}`"
      >
        <FeaturedBanner
          v-if="browsing && featured.length"
          :slides="featuredSlides"
          :locale
          class="mb-10 short:mb-6"
        />

        <template v-if="browsing">
          <WorkshopSections :models :locale @browse="browseAll = true" />

          <button
            type="button"
            class="group mx-auto mt-12 flex w-fit cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 px-8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:w-full"
            data-testid="browse-all-end"
            @click="browseAll = true"
          >
            {{ t('workshop.sections.browseAll') }}
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

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
