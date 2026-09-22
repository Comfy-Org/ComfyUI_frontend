<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  BrowseEntry,
  CatalogueOrder,
  TypeFilter
} from '../../lib/hub/browse-entry'
import {
  browseRequestFrom,
  sortBrowseEntries
} from '../../lib/hub/browse-entry'
import type { WorkshopOutcome } from '../../config/workshop-outcomes'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import { entrySlides } from '../../lib/workshop/featured-slides'
import FeaturedBanner from '../workshop/FeaturedBanner.vue'
import WorkshopHero from '../workshop/WorkshopHero.vue'
import type { OrderOption } from './CatalogueSort.vue'
import CatalogueGrid from './CatalogueGrid.vue'
import CatalogueModelFilter from './CatalogueModelFilter.vue'
import CatalogueSearch from './CatalogueSearch.vue'
import CatalogueToolbar from './CatalogueToolbar.vue'
import CatalogueSort from './CatalogueSort.vue'
import CatalogueTypeFilter from './CatalogueTypeFilter.vue'
import OutcomeRows from './OutcomeRows.vue'
import HubSections from './HubSections.vue'

// The catalogue is resolved on the server and arrives card-sized: the browser
// never receives the model list or the template index, only what the grid
// draws.
const {
  entries,
  locale = 'en',
  modelFilter = false
} = defineProps<{
  entries: readonly BrowseEntry[]
  locale?: Locale
  /**
   * The filter by model. Off while the catalogue is small enough to read
   * whole: a menu of models longer than the list it narrows costs more than it
   * gives, and opening it moves the page. A link naming a model still answers.
   */
  modelFilter?: boolean
}>()

const PAGE = 30

const useCase = ref<UseCase | 'all'>('all')
const type = ref<TypeFilter>('model')
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
  { value: 'newest', label: 'workshop.v2.sort.newest', only: 'workflow' }
]

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

// The registry writes `text-to-image` and a reader types `text to image`, so
// neither side keeps the punctuation that tells them apart.
const searchable = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Built once from what the card already carries, rather than shipped a second
// time as its own field.
const haystacks = computed(
  () =>
    new Map(
      entries.map((entry) => [
        entry.key,
        searchable(
          [
            entry.title,
            entry.card.maker.label,
            ...entry.models,
            ...entry.tags
          ].join(' ')
        )
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
  const wanted = new Set<string>(asked.tags)
  return entry.tags.some((tag) => wanted.has(tag))
}

const usesTheModel = (entry: BrowseEntry, name: string) =>
  name === '' ||
  entry.models.some((model) => normalize(model) === normalize(name))

// Everything but the tab, which is not a narrowing of the catalogue but a
// choice of which catalogue you are in.
const narrowings = computed<((entry: BrowseEntry) => boolean)[]>(() => {
  const text = searchable(query.value)
  return [
    (entry) =>
      useCase.value === 'all' || entry.useCases.includes(useCase.value),
    (entry) => usesTheModel(entry, usesModel.value),
    (entry) => matchesOutcome(entry, outcome.value),
    (entry) => matchesQuery(entry, text)
  ]
})

// An app is a workflow somebody wrapped in a form, so asking for workflows
// returns it too and the badge on the card is what tells them apart.
const isType = (entry: BrowseEntry, filter: TypeFilter) => entry.kind === filter

// The tab is read first and everything downstream sees one kind: the shelves,
// the rows, the order and the banner are all about models or all about
// workflows, and never about both at once.
const inTab = computed(() =>
  entries.filter((entry) => isType(entry, type.value))
)

const matched = computed(() =>
  inTab.value.filter((entry) => narrowings.value.every((holds) => holds(entry)))
)

const sorted = computed(() => sortBrowseEntries(matched.value, order.value))
const visible = computed(() => sorted.value.slice(0, shown.value))

// An order only one kind can honour narrows the type rather than vanishing from
// the menu, and the chip that appears is the explanation.
watch(order, (next) => {
  const only = ORDERS.find((option) => option.value === next)?.only
  if (only) type.value = only
})

// Leaving that type behind leaves the order behind with it: newest over models
// that carry no date is a ranking over nothing.
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

// Each narrowing beside the value that means "not narrowing", so both asking
// whether any is on and putting them all back is one pass over the same list.
// The tab is not among them: it says which catalogue you are in, the way the
// shelf says which use case, and neither is something to be cleared.
const resettable = computed(() => [
  { ref: usesModel, rest: '' },
  { ref: outcome, rest: undefined },
  { ref: query, rest: '' }
])

const narrowed = computed(() =>
  resettable.value.some(({ ref, rest }) => ref.value !== rest)
)

function clearNarrowing() {
  for (const { ref, rest } of resettable.value) ref.value = rest
}

// The shelves are the catalogue at rest: one row per thing you might want to
// make. Asking anything of it, a use case or a search, is what turns it into a
// list. The tab is not one of those: both tabs open on their own shelves.
// A reader who wants the whole half rather than one job asks for it at the
// foot of the shelves: the shelves name the ways in, and this is the way past
// them.
const wholeList = ref(false)

const browsing = computed(
  () => useCase.value !== 'all' || narrowed.value || wholeList.value
)

// What the models page does: the hero introduces the catalogue and steps aside
// once the reader has chosen a section or asked for the half entire, and the
// featured strip stands only while nothing at all has been asked.
const inSection = computed(() => useCase.value !== 'all' || wholeList.value)

// The two halves are searched apart, so the field says which one it is in,
// in the words each already had on its own page.
const searchPlaceholder = computed(() =>
  t(
    type.value === 'workflow'
      ? 'workshop.hub.search'
      : 'workshop.search.placeholder',
    locale
  )
)

function backToShelves() {
  clearNarrowing()
  useCase.value = 'all'
  wholeList.value = false
  order.value = 'popular'
}

onMounted(() => {
  const asked = browseRequestFrom(location.search)
  type.value = asked.type
  useCase.value = asked.useCase
  wholeList.value = asked.all
  usesModel.value = asked.usesModel
  query.value = asked.query
})

// The banner answers the two choices that say what you are browsing, the type
// and the use case, and stays out of a search, which narrows a list rather
// than changing what is in it.
const BANNER_SLIDES = 6

const kindLabelKey: Record<string, TranslationKey> = {
  model: 'workshop.v2.kind.models',
  workflow: 'workshop.v2.kind.workflows'
}

const featured = computed(() =>
  query.value.trim() !== ''
    ? []
    : entrySlides(
        sortBrowseEntries(
          matched.value.filter((entry) => entry.card.media !== undefined),
          'popular'
        ).slice(0, BANNER_SLIDES),
        (entry) => t(kindLabelKey[entry.kind], locale)
      )
)

// The models the workflows on this tab name, most used first, so the filter
// opens on the ones a reader is most likely to be after.
const modelsInTab = computed(() => {
  const counts = new Map<string, number>()
  for (const entry of inTab.value)
    for (const model of entry.models)
      counts.set(model, (counts.get(model) ?? 0) + 1)
  return [...counts]
    .sort(([aName, a], [bName, b]) => b - a || aName.localeCompare(bName))
    .map(([name]) => name)
})

// The rows are a way in, so they stand while the medium is the only thing
// chosen: once a reader narrows further they are past being shown around.
const showRows = computed(() => useCase.value !== 'all' && !narrowed.value)

function openOutcome(asked: WorkshopOutcome) {
  outcome.value = asked
}

const heading = computed(() =>
  useCase.value === 'all'
    ? t('workshop.v2.allOf', locale).replace(
        '{kind}',
        t(kindLabelKey[type.value], locale).toLowerCase()
      )
    : t(useCaseLabelKey[useCase.value], locale)
)
</script>

<template>
  <section class="pb-32" data-testid="catalogue-browse">
    <WorkshopHero
      v-if="!inSection"
      eyebrow-key="workshop.v2.eyebrow"
      heading-key="workshop.v2.heading"
      subtitle-key="workshop.v2.subtitle"
      :locale
    />

    <!-- Where you are and the way out of it, before the controls that act on
      it: the tabs switch halves inside this list rather than announce it. -->
    <div
      v-if="inSection"
      class="mb-4 flex flex-col items-start"
      data-testid="catalogue-place"
    >
      <button
        type="button"
        class="-ms-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition outline-none hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="catalogue-back"
        @click="backToShelves"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.v2.back', locale) }}
      </button>
      <h2
        class="mt-3 text-3xl font-bold text-primary-warm-white sm:text-4xl"
        data-testid="catalogue-heading"
      >
        {{ heading }}
        <span
          class="text-base font-normal text-primary-warm-gray tabular-nums"
          data-testid="catalogue-heading-count"
        >
          {{ matched.length }}
        </span>
      </h2>
    </div>

    <!-- One field and one order read every kind, so they belong to the
      catalogue rather than to the list, and they are there before anything has
      been asked. -->
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="catalogue-header-controls"
    >
      <CatalogueTypeFilter v-model="type" :locale />

      <!-- The type says what is in the list; the search and the order narrow
        and rank what it chose, so they group together away from it. -->
      <div
        class="flex min-w-0 flex-1 items-center gap-3 sm:ms-auto sm:flex-none"
      >
        <CatalogueSearch
          v-model="query"
          :placeholder="searchPlaceholder"
          :locale
        />

        <CatalogueModelFilter
          v-if="modelFilter && type === 'workflow'"
          v-model="usesModel"
          :models="modelsInTab"
          :locale
        />

        <CatalogueSort v-model:order="order" :orders="ORDERS" :locale />
      </div>
    </div>

    <FeaturedBanner
      v-if="!browsing && featured.length"
      :slides="featured"
      :locale
      compact
      class="mb-10 short:mb-6"
    />

    <HubSections
      v-if="!browsing"
      :entries="matched"
      :locale
      @open="useCase = $event"
      @open-all="wholeList = true"
    />

    <div v-else class="min-w-0">
      <CatalogueToolbar
        v-model:uses-model="usesModel"
        :narrowed-by="narrowedBy"
        :outcome-label="outcome ? t(outcome.labelKey, locale) : undefined"
        :locale
        @clear="clearNarrowing"
        @clear-outcome="outcome = undefined"
      />

      <!-- A job is something a workflow does end to end. A model is the
        capability underneath one, so it heads no row and joins none. -->
      <OutcomeRows
        v-if="showRows && type === 'workflow'"
        :entries="matched"
        :locale
        @open="openOutcome"
      />

      <CatalogueGrid
        :visible
        :total="sorted.length"
        :shelf="useCase"
        :locale
        @more="shown += PAGE"
      />
    </div>
  </section>
</template>
