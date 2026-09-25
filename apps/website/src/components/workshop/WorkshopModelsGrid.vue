<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { groupModels } from '../../config/model-family'

import type {
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/models-catalogue'
import {
  parseCatalogSearch,
  USE_CASES,
  countByUseCase,
  filterWorkshopModels,
  sortOrdersFor,
  sortWorkshopModels
} from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { rememberShelfOnClick } from '../../lib/workshop/shelf-memory'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import { modelSlides } from '../../lib/workshop/featured-slides'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSections from './WorkshopSections.vue'
import WorkshopSortMenu from './WorkshopSortMenu.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const useCase = ref<UseCase | 'all' | 'other'>('all')
const selectedUseCases = ref<UseCase[]>([])
const legacyModalities = ref<string[]>([])
const legacyProviders = ref<string[]>([])
const legacyCapabilities = ref<string[]>([])
const sort = ref<SortOrder>('popular')
let scrollReady = false

onMounted(() => {
  const initial = parseCatalogSearch(location.search)
  query.value = initial.query ?? ''
  useCase.value = initial.useCase ?? 'all'
  legacyModalities.value = [...initial.modalities]
  legacyProviders.value = [...initial.providers]
  legacyCapabilities.value = [...initial.capabilities]
  void nextTick(() => {
    scrollReady = true
  })
})

const toolbar = useTemplateRef<HTMLElement>('toolbar')
const heading = useTemplateRef<HTMLElement>('heading')
const sortOrders = sortOrdersFor(models)

const useCaseOptions = computed<FacetMenuOption[]>(() => {
  const counts = countByUseCase(models)
  return USE_CASES.filter((value) => counts[value] > 0).map((value) => ({
    value,
    label: t(useCaseLabelKey[value], locale),
    count: counts[value]
  }))
})

const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      filterWorkshopModels(models, {
        query: query.value,
        useCase: useCase.value,
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
    useCase.value !== 'all' ||
    selectedUseCases.value.length > 0 ||
    legacyModalities.value.length > 0 ||
    legacyProviders.value.length > 0 ||
    legacyCapabilities.value.length > 0
)

// Willie's browseable listing: rows per use case until the visitor narrows
// down, then the flat grid takes over.
const browseAll = defineModel<boolean>('browseAll', { default: false })
watch(
  [useCase, browseAll, () => query.value.trim() !== ''],
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
const inSection = computed(() => useCase.value !== 'all' || browseAll.value)
const sectionTitleKey = computed<TranslationKey>(() =>
  useCase.value === 'all'
    ? 'workshop.sections.allModels'
    : useCase.value === 'other'
      ? 'workshop.sections.otherFormats'
      : useCaseLabelKey[useCase.value]
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

function openSection(value: UseCase | 'other') {
  useCase.value = value
}

function leaveSection() {
  clearFilters()
}

function resetFilters() {
  query.value = ''
  useCase.value = 'all'
  selectedUseCases.value = []
  legacyModalities.value = []
  legacyProviders.value = []
  legacyCapabilities.value = []
}

function applyUseCases(values: UseCase[]) {
  selectedUseCases.value = values
  if (values.length) useCase.value = 'all'
}

function clearFilters() {
  browseAll.value = false
  resetFilters()
}

function rememberModel(
  model: WorkshopModel,
  event: MouseEvent,
  shelf = useCase.value
) {
  rememberShelfOnClick(shelf, model.href, event)
}

watch(browseAll, (on) => on && resetFilters())
</script>

<template>
  <section class="gap-10">
    <div class="min-w-0">
      <button
        v-if="inSection"
        type="button"
        class="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-back"
        @click="leaveSection"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back', locale) }}
      </button>

      <!-- scroll-mt tracks the nav height; the toolbar's is lower because its py-4 absorbs the difference -->
      <h1
        v-if="inSection"
        ref="heading"
        class="mt-3 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ t(sectionTitleKey, locale) }}
        <span class="text-base font-normal text-primary-warm-gray tabular-nums">
          {{ visible.length }}
        </span>
      </h1>

      <div
        ref="toolbar"
        data-testid="workshop-toolbar"
        class="sticky top-20 z-30 -mx-1 mb-8 flex scroll-mt-20 flex-wrap items-center justify-end gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 sm:flex-nowrap lg:top-26 lg:scroll-mt-26"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3 max-sm:basis-full">
          <WorkshopSearchField
            v-model="query"
            :models
            :locale
            compact
            class="min-w-0 flex-1 sm:mr-auto sm:max-w-xl sm:min-w-32"
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
          @click="browseAll = true"
        >
          {{ t('workshop.sections.browseAll', locale) }}
          <ChevronRight
            class="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </template>

      <template v-else>
        <div v-if="visible.length">
          <h2 id="workshop-models-heading" class="sr-only">
            {{ t('workshop.models.heading', locale) }}
          </h2>
          <ul
            class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
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
            {{ t('workshop.empty.heading', locale) }}
          </p>
          <p class="text-sm text-primary-warm-gray">
            {{ t('workshop.empty.body', locale) }}
          </p>
          <Button
            v-if="isFiltered"
            variant="outline"
            size="sm"
            @click="clearFilters"
          >
            {{ t('workshop.empty.clear', locale) }}
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
