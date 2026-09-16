<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'
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
import HubUseCaseNav from './HubUseCaseNav.vue'

// The catalogue is resolved on the server and arrives card-sized: the browser
// never receives the model list or the template index, only what the grid
// draws and the facets read.
const { entries, locale = 'en' } = defineProps<{
  entries: readonly BrowseEntry[]
  locale?: Locale
}>()

const PAGE = 30

const type = ref<TypeFilter>('all')
const useCase = ref<UseCase | 'all'>('all')
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
// Reading capabilities first is honest, but 122 model cards before the first
// workflow is two catalogues stacked. The mixed view leads with a strip of
// models and hands the rest to the type facet.
const LEAD_MODELS = 6

const mixed = computed(() => type.value === 'all' && order.value === 'popular')

const sorted = computed(() => {
  const list = sortBrowseEntries(matched.value, order.value)
  if (!mixed.value) return list
  const models = list.filter((entry) => entry.kind === 'model')
  return [
    ...models.slice(0, LEAD_MODELS),
    ...list.filter((entry) => entry.kind !== 'model')
  ]
})
const visible = computed(() => sorted.value.slice(0, shown.value))

const modelsHeld = computed(() =>
  mixed.value ? Math.max(0, countOf('model') - LEAD_MODELS) : 0
)

const providers = computed(() =>
  [
    ...new Set(
      entries.flatMap((entry) => (entry.provider ? [entry.provider] : []))
    )
  ].sort()
)

const useCaseTabs = computed(() =>
  [
    'all' as const,
    ...USE_CASES.filter((value) =>
      entries.some((entry) => entry.useCases.includes(value))
    )
  ].map((value) => ({
    value,
    label:
      value === 'all'
        ? t('workshop.v2.kind.all', locale)
        : t(useCaseLabelKey[value], locale)
  }))
)

// An order only one kind can honour narrows the type rather than vanishing from
// the menu, and the chip that appears is the explanation.
watch(order, (next) => {
  const only = ORDERS.find((option) => option.value === next)?.only
  if (only) type.value = only
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
  { ref: useCase, rest: 'all' as const },
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
    </header>

    <div class="gap-10 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        class="mb-8 lg:sticky lg:top-28 lg:mb-0 lg:max-h-[calc(100vh-9rem)] lg:scrollbar-thin lg:self-start lg:overflow-y-auto lg:pt-4"
      >
        <HubUseCaseNav
          rail-beside
          :entries="useCaseTabs"
          :current="useCase"
          :label="t('workshop.media.label', locale)"
          @select="useCase = $event"
        />
      </aside>

      <div class="min-w-0">
        <CatalogueToolbar
          v-model:query="query"
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

        <p
          v-if="modelsHeld > 0"
          class="mb-4 text-sm text-content-muted"
          data-testid="catalogue-models-held"
        >
          {{
            t('workshop.v2.modelsHeld', locale).replace(
              '{n}',
              String(modelsHeld)
            )
          }}
          <button
            type="button"
            class="cursor-pointer underline underline-offset-4 hover:text-content-bright"
            @click="type = 'model'"
          >
            {{ t('workshop.v2.seeModels', locale) }}
          </button>
        </p>

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

        <div
          v-if="shown < sorted.length"
          class="flex justify-center pt-10 pb-4"
        >
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
    </div>
  </section>
</template>
