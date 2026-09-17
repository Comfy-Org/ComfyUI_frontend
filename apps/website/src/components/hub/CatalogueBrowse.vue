<script setup lang="ts">
import { ChevronLeft, Search } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  BrowseEntry,
  CatalogueOrder,
  NeedsFilter,
  TypeFilter
} from '../../lib/hub/browse-entry'
import {
  browseRequestFrom,
  sortBrowseEntries
} from '../../lib/hub/browse-entry'
import type { WorkshopOutcome } from '../../config/workshop-outcomes'
import { capabilitiesOf } from '../../config/workshop-outcomes'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import { entrySlides } from '../../lib/workshop/featured-slides'
import FeaturedBanner from '../workshop/FeaturedBanner.vue'
import WorkshopHero from '../workshop/WorkshopHero.vue'
import type { FacetSheetGroup } from '../workshop/FacetSheet.vue'
import type { OrderOption } from './CatalogueControls.vue'
import CatalogueCard from './CatalogueCard.vue'
import CatalogueControls from './CatalogueControls.vue'
import CatalogueToolbar from './CatalogueToolbar.vue'
import CatalogueTypeFilter from './CatalogueTypeFilter.vue'
import OutcomeRows from './OutcomeRows.vue'
import PlaygroundSections from './PlaygroundSections.vue'

// The catalogue is resolved on the server and arrives card-sized: the browser
// never receives the model list or the template index, only what the grid
// draws and the facets read.
const { entries, locale = 'en' } = defineProps<{
  entries: readonly BrowseEntry[]
  locale?: Locale
}>()

const PAGE = 30

const useCase = ref<UseCase | 'all'>('all')
const type = ref<TypeFilter>('all')
const needs = ref<NeedsFilter>('any')
const provider = ref('all')
const order = ref<CatalogueOrder>('popular')
const query = ref('')
// Set by a model card's "N workflows use this": the catalogue arrives already
// narrowed to that model's uses, with a chip saying so.
const usesModel = ref('')
// A curated row, asked to be seen in full. It narrows by the same tags the row
// was built from, so the listing holds exactly what the row was showing.
const outcome = ref<WorkshopOutcome | undefined>()
const shown = ref(PAGE)

const ORDERS: readonly OrderOption[] = [
  { value: 'popular', label: 'workshop.v2.sort.popular' },
  { value: 'name', label: 'workshop.v2.sort.name' },
  { value: 'newest', label: 'workshop.v2.sort.newest', only: 'workflow' },
  { value: 'priceAsc', label: 'workshop.v2.sort.priceAsc', only: 'model' },
  { value: 'priceDesc', label: 'workshop.v2.sort.priceDesc', only: 'model' }
]

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function meetsNeeds(entry: BrowseEntry, filter: NeedsFilter): boolean {
  if (filter === 'any') return true
  if (filter === 'runsHere') return entry.runsHere
  if (filter === 'comfyui') return entry.kind !== 'model'
  return entry.needsCustomNodes
}

// Built once from what the card already carries, rather than shipped a second
// time as its own field.
const haystacks = computed(
  () =>
    new Map(
      entries.map((entry) => [
        entry.key,
        [entry.title, entry.card.maker.label, ...entry.models, ...entry.tags]
          .join(' ')
          .toLowerCase()
      ])
    )
)

const matchesQuery = (entry: BrowseEntry, text: string) =>
  text === '' || (haystacks.value.get(entry.key) ?? '').includes(text)

const matchesOutcome = (
  entry: BrowseEntry,
  asked: WorkshopOutcome | undefined
) => {
  if (!asked) return true
  const wanted = new Set<string>([...asked.tags, ...capabilitiesOf(asked)])
  return entry.tags.some((tag) => wanted.has(tag))
}

const usesTheModel = (entry: BrowseEntry, name: string) =>
  name === '' ||
  entry.models.some((model) => normalize(model) === normalize(name))

// Everything but the type, so the type counts can say what choosing each one
// would return rather than how many exist in the abstract.
const narrowings = computed<((entry: BrowseEntry) => boolean)[]>(() => {
  const text = query.value.trim().toLowerCase()
  return [
    (entry) =>
      useCase.value === 'all' || entry.useCases.includes(useCase.value),
    (entry) => meetsNeeds(entry, needs.value),
    (entry) => provider.value === 'all' || entry.provider === provider.value,
    (entry) => usesTheModel(entry, usesModel.value),
    (entry) => matchesOutcome(entry, outcome.value),
    (entry) => matchesQuery(entry, text)
  ]
})

const beforeType = computed(() =>
  entries.filter((entry) => narrowings.value.every((holds) => holds(entry)))
)

const countOf = (value: TypeFilter) =>
  value === 'all'
    ? beforeType.value.length
    : beforeType.value.filter((entry) => entry.kind === value).length

const counts = computed(() => ({
  all: countOf('all'),
  model: countOf('model'),
  workflow: countOf('workflow'),
  app: countOf('app')
}))

const matched = computed(() =>
  type.value === 'all'
    ? beforeType.value
    : beforeType.value.filter((entry) => entry.kind === type.value)
)

const sorted = computed(() => sortBrowseEntries(matched.value, order.value))
const visible = computed(() => sorted.value.slice(0, shown.value))

const NEEDS: readonly { value: NeedsFilter; label: TranslationKey }[] = [
  { value: 'runsHere', label: 'workshop.v2.needs.runsHere' },
  { value: 'comfyui', label: 'workshop.v2.needs.comfyui' },
  { value: 'customNodes', label: 'workshop.v2.needs.customNodes' }
]

// A count says what choosing that option would return, so it is taken with
// every other narrowing still on and that one lifted.
function countWithout(
  lifted: (entry: BrowseEntry) => boolean,
  holds: (entry: BrowseEntry) => boolean
): number {
  const others = narrowings.value.filter((one) => one !== lifted)
  return entries.filter(
    (entry) =>
      holds(entry) &&
      others.every((one) => one(entry)) &&
      (type.value === 'all' || entry.kind === type.value)
  ).length
}

const facetGroups = computed<FacetSheetGroup[]>(() => [
  {
    key: 'needs',
    label: t('workshop.v2.filter.needs', locale),
    selected: needs.value === 'any' ? [] : [needs.value],
    options: NEEDS.map((option) => ({
      value: option.value,
      label: t(option.label, locale),
      count: countWithout(narrowings.value[1], (entry) =>
        meetsNeeds(entry, option.value)
      )
    }))
  },
  {
    key: 'provider',
    label: t('workshop.v2.filter.provider', locale),
    selected: provider.value === 'all' ? [] : [provider.value],
    options: providers.value.map((name) => ({
      value: name,
      label: name,
      count: countWithout(
        narrowings.value[2],
        (entry) => entry.provider === name
      )
    }))
  }
])

// A facet is one choice, so picking what is already picked is how it comes off.
const PICKERS: Record<string, (value: string) => void> = {
  needs: (value) => {
    needs.value = needs.value === value ? 'any' : (value as NeedsFilter)
  },
  provider: (value) => {
    provider.value = provider.value === value ? 'all' : value
  }
}

function pickFacet(group: string, value: string) {
  PICKERS[group]?.(value)
}

const providers = computed(() =>
  [
    ...new Set(
      entries.flatMap((entry) => (entry.provider ? [entry.provider] : []))
    )
  ].sort()
)

// An order only one kind can honour narrows the type rather than vanishing from
// the menu, and the chip that appears is the explanation.
watch(order, (next) => {
  const only = ORDERS.find((option) => option.value === next)?.only
  if (only) type.value = only
})

// Leaving that type behind leaves the order behind with it: a price ascending
// over workflows that carry no price is a ranking over nothing.
watch(type, (next) => {
  const only = ORDERS.find((option) => option.value === order.value)?.only
  if (only && only !== next) order.value = 'popular'
})

watch([matched, order], () => {
  shown.value = PAGE
})

const narrowedBy = computed(
  () => ORDERS.find((option) => option.value === order.value)?.only
)

// Each filter beside the value that means "not filtering", so both asking
// whether any is on and putting them all back is one pass over the same list.
const resettable = computed(() => [
  { ref: type, rest: 'all' as const },
  { ref: needs, rest: 'any' as const },
  { ref: provider, rest: 'all' },
  { ref: usesModel, rest: '' },
  { ref: outcome, rest: undefined },
  { ref: query, rest: '' }
])

const filtersOn = computed(() =>
  resettable.value.some(({ ref, rest }) => ref.value !== rest)
)

function clearFilters() {
  for (const { ref, rest } of resettable.value) ref.value = rest
  order.value = 'popular'
}

// The shelves are the catalogue at rest: one row per thing you might want to
// make. Asking anything of it at all, a use case, a search, a facet, is what
// turns it into a list.
const browsing = computed(() => useCase.value !== 'all' || filtersOn.value)

function backToShelves() {
  clearFilters()
  useCase.value = 'all'
}

onMounted(() => {
  const asked = browseRequestFrom(location.search)
  type.value = asked.type
  useCase.value = asked.useCase
  usesModel.value = asked.usesModel
  query.value = asked.query
})

const showingText = computed(() =>
  t('workshop.v2.showing', locale)
    .replace('{shown}', String(visible.value.length))
    .replace('{total}', String(sorted.value.length))
)

// The banner answers the two choices that say what you are browsing, the type
// and the use case, and stays out of a search, which narrows a list rather
// than changing what is in it.
const BANNER_SLIDES = 6

const kindLabelKey: Record<string, TranslationKey> = {
  model: 'workshop.v2.kind.models',
  workflow: 'workshop.v2.kind.workflows',
  app: 'workshop.v2.kind.apps'
}

const featured = computed(() =>
  query.value.trim() !== ''
    ? []
    : entrySlides(
        sortBrowseEntries(
          beforeType.value.filter(
            (entry) =>
              entry.card.media !== undefined &&
              (type.value === 'all' || entry.kind === type.value)
          ),
          'popular'
        ).slice(0, BANNER_SLIDES),
        (entry) => t(kindLabelKey[entry.kind], locale)
      )
)

// The rows are a way in, so they stand while the medium is the only thing
// chosen: once a reader narrows further they are past being shown around.
const showRows = computed(() => useCase.value !== 'all' && !filtersOn.value)

function openOutcome(asked: WorkshopOutcome) {
  outcome.value = asked
}

const heading = computed(() =>
  useCase.value === 'all'
    ? t('workshop.v2.kind.all', locale)
    : t(useCaseLabelKey[useCase.value], locale)
)
</script>

<template>
  <section class="pb-32" data-testid="catalogue-browse">
    <WorkshopHero
      eyebrow-key="workshop.v2.eyebrow"
      heading-key="workshop.v2.heading"
      subtitle-key="workshop.v2.subtitle"
      :locale
    />

    <!-- One field and one set of controls read every kind, so they belong to
      the catalogue rather than to the list, and they are there before
      anything has been asked. The type sits beside the search because it is
      the same kind of choice: what you are looking at, not how it is ordered. -->
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="catalogue-header-controls"
    >
      <CatalogueTypeFilter v-model="type" :counts :locale />

      <div class="relative min-w-56 flex-1 sm:max-w-sm">
        <Search
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-muted"
          aria-hidden="true"
        />
        <input
          id="catalogue-search"
          v-model="query"
          type="search"
          :placeholder="t('workshop.v2.search', locale)"
          :aria-label="t('workshop.v2.search', locale)"
          class="h-11 w-full rounded-2xl bg-transparency-white-t4 ps-9 pe-3 text-sm text-content transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        />
      </div>

      <CatalogueControls
        v-model:order="order"
        :orders="ORDERS"
        :groups="facetGroups"
        :filters-on="filtersOn"
        :result-count="sorted.length"
        :locale
        @clear="clearFilters"
        @pick="pickFacet"
      />
    </div>

    <FeaturedBanner
      v-if="featured.length"
      :slides="featured"
      :locale
      class="mb-10 short:mb-6"
    />

    <PlaygroundSections
      v-if="!browsing"
      :entries
      :locale
      @open="useCase = $event"
    />

    <div v-else class="min-w-0">
      <div
        v-if="useCase !== 'all'"
        class="mb-6 flex flex-wrap items-baseline gap-4"
      >
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1 rounded-lg text-sm text-content-muted transition-colors outline-none hover:text-content-bright focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          data-testid="catalogue-back"
          @click="backToShelves"
        >
          <ChevronLeft class="size-4" aria-hidden="true" />
          {{ t('workshop.sections.back', locale) }}
        </button>
        <h2
          class="text-xl font-medium text-primary-warm-white"
          data-testid="catalogue-heading"
        >
          {{ heading }}
        </h2>
      </div>

      <CatalogueToolbar
        v-model:uses-model="usesModel"
        :narrowed-by="narrowedBy"
        :outcome-label="outcome ? t(outcome.labelKey, locale) : undefined"
        :filters-on="filtersOn"
        :locale
        @clear="clearFilters"
        @clear-outcome="outcome = undefined"
      />

      <OutcomeRows
        v-if="showRows && useCase !== 'all'"
        :use-case="useCase"
        :entries="beforeType"
        :locale
        @open="openOutcome"
      />

      <div
        v-if="visible.length > 0"
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="catalogue-grid"
      >
        <CatalogueCard
          v-for="entry in visible"
          :key="entry.key"
          :view="entry.card"
          :locale
        />
      </div>
      <div
        v-else
        class="py-20 text-center text-content-muted"
        data-testid="catalogue-empty"
      >
        <p class="text-lg">{{ t('workshop.v2.empty', locale) }}</p>
        <p class="mt-2 text-sm">{{ t('workshop.v2.emptyHint', locale) }}</p>
      </div>

      <div v-if="shown < sorted.length" class="flex justify-center pt-10 pb-4">
        <button
          type="button"
          class="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-brand px-12 text-sm font-semibold tracking-wider text-brand uppercase transition-colors hover:bg-brand hover:text-page"
          data-testid="catalogue-load-more"
          @click="shown += PAGE"
        >
          {{ t('workshop.v2.loadMore', locale) }}
        </button>
      </div>

      <p
        v-if="visible.length > 0"
        class="pt-2 pb-4 text-center text-sm text-hub-muted"
        data-testid="catalogue-showing"
      >
        {{ showingText }}
      </p>
    </div>
  </section>
</template>
