<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useDebounceFn } from '@vueuse/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { groupModels } from '@/config/model-family'
import { getRoutes } from '@/config/routes'

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
  sortWorkshopModels,
  withCatalogSearch
} from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import { rememberShelfOnClick } from '@/lib/workshop/shelf-memory'
import { openedUseCases, shelfOf } from '@/lib/workshop/shelf-use-cases'
import { sectionTitleKeyFor } from '@/lib/workshop/section-title'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import { CARD_GRID } from '@/lib/workshop/card-layout'
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
const legacyModalities = ref<string[]>([])
const legacyProviders = ref<string[]>([])
const legacyCapabilities = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const openedShelf = computed(() => shelfOf(selectedUseCases.value))
// Willie's browseable listing: rows per use case until the visitor narrows
// down, then the flat grid takes over.
const browseAll = defineModel<boolean>('browseAll', { default: false })
let scrollReady = false
let addressWritable = false
let pushNextAddress = false

function readAddress(search: string) {
  const address = parseCatalogSearch(search)
  query.value = address.query
  selectedUseCases.value = [
    ...new Set(address.useCases.flatMap(openedUseCases))
  ]
  sort.value = sortOrders.includes(address.sort) ? address.sort : 'popular'
  browseAll.value = address.browseAll
  legacyModalities.value = [...address.modalities]
  legacyProviders.value = [...address.providers]
  legacyCapabilities.value = [...address.capabilities]
}

// Opening or leaving a section is a step Back should undo; anything else,
// typing above all, replaces the entry so the back stack stays short.
function writeAddress() {
  if (!addressWritable || location.pathname !== getRoutes(locale).workshop)
    return
  const shelf = openedShelf.value
  const search = withCatalogSearch(location.search, {
    query: query.value.trim(),
    useCases: shelf === 'all' ? selectedUseCases.value : [shelf],
    sort: sort.value,
    browseAll: browseAll.value,
    modalities: legacyModalities.value,
    providers: legacyProviders.value,
    capabilities: legacyCapabilities.value
  })
  const push = pushNextAddress
  pushNextAddress = false
  if (search === location.search) return
  const url = `${location.pathname}${search}${location.hash}`
  if (!push) {
    history.replaceState(history.state, '', url)
    return
  }
  // Shaped like the router's own entries, so it restores this one on Back.
  const index = Number(history.state?.index ?? 0) + 1
  history.pushState({ index, scrollX: 0, scrollY: 0 }, '', url)
}

function stepAddress() {
  pushNextAddress = true
  void nextTick(() => {
    pushNextAddress = false
  })
}
const writeTypedAddress = useDebounceFn(writeAddress, 300)
watch(query, () => {
  if (addressWritable) void writeTypedAddress()
})
watch(
  [
    selectedUseCases,
    sort,
    browseAll,
    legacyModalities,
    legacyProviders,
    legacyCapabilities
  ],
  writeAddress
)

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
  // Mounting mid-navigation, the address may still be the previous page's.
  void nextTick(() => {
    scrollReady = true
    addressWritable = true
  })
})
onBeforeUnmount(() => {
  addressWritable = false
  window.removeEventListener('pageshow', onPageShow)
})

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

const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      filterWorkshopModels(models, {
        query: query.value,
        useCases: selectedUseCases.value,
        modalities: legacyModalities.value,
        providers: legacyProviders.value,
        capabilities: legacyCapabilities.value
      }),
      sort.value
    )
  )
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    selectedUseCases.value.length > 0 ||
    legacyModalities.value.length > 0 ||
    legacyProviders.value.length > 0 ||
    legacyCapabilities.value.length > 0
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
const browsing = computed(() => !isFiltered.value && !browseAll.value)
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
// Inside a category the tabs give up the row, and the search takes it.
const searchClass = computed(() =>
  cn('min-w-0 flex-1', !inSection.value && 'sm:max-w-120')
)

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

function openSection(value: UseCase | 'other') {
  selectedUseCases.value = openedUseCases(value)
  stepAddress()
}

function leaveSection() {
  clearFilters()
  stepAddress()
}

function resetFilters() {
  query.value = ''
  selectedUseCases.value = []
  legacyModalities.value = []
  legacyProviders.value = []
  legacyCapabilities.value = []
}

function applyUseCases(values: UseCase[]) {
  selectedUseCases.value = values
}

function openBrowseAll() {
  resetFilters()
  browseAll.value = true
  stepAddress()
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
</script>

<template>
  <section class="gap-10">
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
          {{ visible.length }}
        </span>
      </h2>

      <div
        :id="HUB_TOOLBAR_ID"
        ref="toolbar"
        data-testid="workshop-toolbar"
        class="sticky top-20 z-30 -mx-1 mb-8 flex scroll-mt-20 flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26 lg:scroll-mt-26"
      >
        <slot name="tabs" />
        <div
          class="flex min-w-0 flex-1 items-center gap-3 max-sm:basis-full sm:min-w-fit sm:justify-end"
        >
          <WorkshopSearchField
            v-model="query"
            :models
            :locale
            compact
            :class="searchClass"
          />

          <div class="flex items-center gap-2" data-testid="workshop-filters">
            <WorkshopFilterMenu
              :use-cases="selectedUseCases"
              :use-case-options="useCaseOptions"
              :result-count="visible.length"
              :locale
              @update:use-cases="applyUseCases"
            />

            <WorkshopSortMenu v-model="sort" :orders="sortOrders" :locale />
          </div>
        </div>
      </div>

      <FeaturedBanner
        v-if="browsing && featured.length"
        :slides="featuredSlides"
        :locale
        class="mb-10 short:mb-6"
      />

      <template v-if="browsing">
        <WorkshopSections
          :models
          :label-key="useCaseLabelKey"
          :sort
          :locale
          @open="openSection"
        />

        <button
          type="button"
          class="group mx-auto mt-12 flex w-fit cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 px-8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:w-full"
          data-testid="browse-all-end"
          @click="openBrowseAll"
        >
          {{ t('workshop.sections.browseAll') }}
          <ChevronRight
            class="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </template>

      <template v-else>
        <div v-if="visible.length">
          <h2 id="workshop-models-heading" class="sr-only">
            {{ t('workshop.models.heading') }}
          </h2>
          <ul
            :class="CARD_GRID"
            aria-labelledby="workshop-models-heading"
            data-testid="workshop-models-grid"
          >
            <li v-for="family in visible" :key="family.key">
              <WorkshopModelCard
                :model="family.latest"
                :locale
                @click="rememberModel(family.latest, $event)"
              />
            </li>
          </ul>
        </div>

        <div
          v-else
          class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-16 text-center"
          data-testid="workshop-empty"
        >
          <p class="text-lg font-semibold text-primary-comfy-canvas">
            {{ t('workshop.empty.heading') }}
          </p>
          <p class="text-sm text-primary-warm-gray">
            {{ t('workshop.empty.body') }}
          </p>
          <Button
            v-if="isFiltered"
            variant="outline"
            size="sm"
            @click="clearFilters"
          >
            {{ t('workshop.empty.clear') }}
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
