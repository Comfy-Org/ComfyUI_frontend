<script setup lang="ts">
import { ChevronLeft, Search } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  BrowseEntry,
  CatalogueOrder,
  NeedsFilter,
  OutputFilter,
  TypeFilter
} from '../../lib/hub/browse-entry'
import {
  browseRequestFrom,
  sortBrowseEntries
} from '../../lib/hub/browse-entry'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import type { OrderOption } from './CatalogueToolbar.vue'
import CatalogueCard from './CatalogueCard.vue'
import CatalogueToolbar from './CatalogueToolbar.vue'
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
const output = ref<OutputFilter>('all')
const provider = ref('all')
const order = ref<CatalogueOrder>('popular')
const query = ref('')
// Set by a model card's "N workflows use this": the catalogue arrives already
// narrowed to that model's uses, with a chip saying so.
const usesModel = ref('')
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
        [
          entry.title,
          entry.card.maker.label,
          ...entry.models,
          ...entry.card.tags
        ]
          .join(' ')
          .toLowerCase()
      ])
    )
)

const matchesQuery = (entry: BrowseEntry, text: string) =>
  text === '' || (haystacks.value.get(entry.key) ?? '').includes(text)

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
    (entry) => output.value === 'all' || entry.outputs.includes(output.value),
    (entry) => provider.value === 'all' || entry.provider === provider.value,
    (entry) => usesTheModel(entry, usesModel.value),
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
  { ref: output, rest: 'all' as const },
  { ref: provider, rest: 'all' },
  { ref: usesModel, rest: '' },
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

const heading = computed(() =>
  useCase.value === 'all'
    ? t('workshop.v2.kind.all', locale)
    : t(useCaseLabelKey[useCase.value], locale)
)
</script>

<template>
  <section class="pb-32" data-testid="catalogue-browse">
    <header class="mb-10 max-w-3xl">
      <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
        {{ t('workshop.v2.heading', locale) }}
      </h1>
      <p class="mt-4 text-lg text-primary-comfy-canvas/70">
        {{ t('workshop.v2.subtitle', locale) }}
      </p>
      <!-- One field reads every kind, so it belongs to the catalogue rather
        than to the list, and it is there before anything has been asked. -->
      <div class="relative mt-6 max-w-md">
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
          class="h-10 w-full rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 ps-9 pe-3 text-sm text-content outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        />
      </div>
    </header>

    <PlaygroundSections
      v-if="!browsing"
      :entries
      :locale
      @open="useCase = $event"
    />

    <div v-else class="min-w-0">
      <div class="mb-6 flex flex-wrap items-baseline gap-4">
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
        v-model:order="order"
        v-model:type="type"
        v-model:needs="needs"
        v-model:output="output"
        v-model:provider="provider"
        v-model:uses-model="usesModel"
        :orders="ORDERS"
        :counts
        :providers
        :narrowed-by="narrowedBy"
        :filters-on="filtersOn"
        :locale
        @clear="clearFilters"
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
