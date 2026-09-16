<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Modality, UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplateDetails from '../../data/hubTemplateDetails.json'
import hubTemplates from '../../data/hubTemplates.json'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  CatalogueEntry,
  CatalogueOrder,
  EntryKind
} from '../../lib/hub/catalogue-entries'
import {
  buildCatalogue,
  entryProvider,
  entryUseCases,
  sortCatalogue
} from '../../lib/hub/catalogue-entries'
import { cardViewFor } from '../../lib/hub/catalogue-card'
import { withFacetFields } from '../../lib/hub/facet-fields'
import { tagDisplayName } from '../../lib/hub/tag-aliases'
import {
  hubTemplateDetailsSchema,
  hubTemplatesSchema
} from '../../lib/hub/types'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import CatalogueCard from './CatalogueCard.vue'
import HubUseCaseNav from './HubUseCaseNav.vue'

// Prices come from the page: the Router's estimate is resolved at build
// time, so a card never waits on 122 asynchronous lookups to show one.
const { locale = 'en', prices = {} } = defineProps<{
  locale?: Locale
  prices?: Readonly<Record<string, string>>
}>()

const priceBySlug = computed(() => new Map(Object.entries(prices)))

const templates = hubTemplatesSchema
  .parse(hubTemplates)
  .map((template) => withFacetFields(template, workshopModels))
const details = hubTemplateDetailsSchema.parse(hubTemplateDetails)
const needsCustomNodes = new Set(
  Object.entries(details)
    .filter(([, detail]) => (detail.requiresCustomNodes?.length ?? 0) > 0)
    .map(([name]) => name)
)
const entries = buildCatalogue(templates, workshopModels)

type TypeFilter = 'all' | EntryKind
type NeedsFilter = 'any' | 'runsHere' | 'comfyui' | 'customNodes'
type OutputFilter = 'all' | Modality

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

const ORDERS: readonly {
  value: CatalogueOrder
  label: TranslationKey
  only?: EntryKind
}[] = [
  { value: 'popular', label: 'workshop.v2.sort.popular' },
  { value: 'name', label: 'workshop.v2.sort.name' },
  { value: 'newest', label: 'workshop.v2.sort.newest', only: 'workflow' },
  { value: 'priceAsc', label: 'workshop.v2.sort.priceAsc', only: 'model' },
  { value: 'priceDesc', label: 'workshop.v2.sort.priceDesc', only: 'model' }
]

const TYPES: readonly { value: TypeFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.kind.all' },
  { value: 'model', label: 'workshop.v2.kind.models' },
  { value: 'workflow', label: 'workshop.v2.kind.workflows' },
  { value: 'app', label: 'workshop.v2.kind.apps' }
]

const NEEDS: readonly { value: NeedsFilter; label: TranslationKey }[] = [
  { value: 'any', label: 'workshop.v2.needs.any' },
  { value: 'runsHere', label: 'workshop.v2.needs.runsHere' },
  { value: 'comfyui', label: 'workshop.v2.needs.comfyui' },
  { value: 'customNodes', label: 'workshop.v2.needs.customNodes' }
]

const OUTPUTS: readonly { value: OutputFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'workshop.v2.output.any' },
  { value: 'image', label: 'workshop.hub.io.image' },
  { value: 'video', label: 'workshop.hub.io.video' },
  { value: 'audio', label: 'workshop.hub.io.audio' },
  { value: '3d', label: 'workshop.hub.io.3d' }
]

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function outputsOf(entry: CatalogueEntry): readonly string[] {
  if (entry.kind !== 'model') return [entry.template.mediaType]
  return entry.operations.flatMap(
    (model): readonly string[] =>
      model.modalities ?? (model.modality ? [model.modality] : [])
  )
}

function meetsNeeds(entry: CatalogueEntry, filter: NeedsFilter): boolean {
  if (filter === 'any') return true
  if (filter === 'runsHere')
    return entry.kind === 'model' || entry.runsOn !== undefined
  if (filter === 'comfyui') return entry.kind !== 'model'
  return entry.kind !== 'model' && needsCustomNodes.has(entry.template.name)
}

function matchesQuery(entry: CatalogueEntry, text: string): boolean {
  if (text === '') return true
  const haystack =
    entry.kind === 'model'
      ? [
          entry.model.name,
          entry.model.provider ?? '',
          ...entry.model.capabilities
        ]
      : [
          entry.template.title,
          entry.template.username,
          ...entry.template.models,
          ...entry.template.tags.map(tagDisplayName)
        ]
  return haystack.some((value) => value.toLowerCase().includes(text))
}

const usesTheModel = (entry: CatalogueEntry, name: string) =>
  name === '' ||
  (entry.kind !== 'model' &&
    entry.template.models.some((model) => normalize(model) === normalize(name)))

// Everything but the type, so the type counts can say what choosing each one
// would return rather than how many exist in the abstract.
const beforeType = computed(() => {
  const text = query.value.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      (useCase.value === 'all' ||
        entryUseCases(entry, workshopModels).includes(useCase.value)) &&
      meetsNeeds(entry, needs.value) &&
      (output.value === 'all' || outputsOf(entry).includes(output.value)) &&
      (provider.value === 'all' || entryProvider(entry) === provider.value) &&
      usesTheModel(entry, usesModel.value) &&
      matchesQuery(entry, text)
  )
})

const countOf = (value: TypeFilter) =>
  value === 'all'
    ? beforeType.value.length
    : beforeType.value.filter((entry) => entry.kind === value).length

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
  const list = sortCatalogue(matched.value, order.value)
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
    ...new Set(entries.map(entryProvider).filter((name) => Boolean(name)))
  ].sort()
)

const useCaseTabs = computed(() =>
  [
    'all' as const,
    ...USE_CASES.filter((value) =>
      entries.some((entry) =>
        entryUseCases(entry, workshopModels).includes(value)
      )
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

const filtersOn = computed(
  () =>
    type.value !== 'all' ||
    useCase.value !== 'all' ||
    needs.value !== 'any' ||
    output.value !== 'all' ||
    provider.value !== 'all' ||
    usesModel.value !== '' ||
    query.value !== ''
)

function clearFilters() {
  type.value = 'all'
  useCase.value = 'all'
  needs.value = 'any'
  output.value = 'all'
  provider.value = 'all'
  usesModel.value = ''
  query.value = ''
  order.value = 'popular'
}

onMounted(() => {
  const params = new URLSearchParams(location.search)
  const wantedType = TYPES.find((option) => option.value === params.get('type'))
  if (wantedType) type.value = wantedType.value
  const wantedUseCase = USE_CASES.find(
    (value) => value === params.get('useCase')
  )
  if (wantedUseCase) useCase.value = wantedUseCase
  const model = params.get('model')
  if (model) {
    usesModel.value = model
    type.value = 'workflow'
  }
  const text = params.get('q')
  if (text) query.value = text
})

const showingText = computed(() =>
  t('workshop.v2.showing', locale)
    .replace('{shown}', String(visible.value.length))
    .replace('{total}', String(sorted.value.length))
)

const selectClass =
  'h-10 cursor-pointer rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-content outline-none transition-colors hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
const chipClass =
  'inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-3 text-xs text-content'
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
        <div class="sticky top-20 z-30 mb-6 bg-page py-4 lg:top-26">
          <!-- One field reads both kinds, so it is not a property of any one
            facet and sits above all of them. -->
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <div class="relative min-w-0 flex-1 sm:max-w-md">
              <Search
                class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-muted"
                aria-hidden="true"
              />
              <input
                v-model="query"
                type="search"
                :placeholder="t('workshop.v2.search', locale)"
                :aria-label="t('workshop.v2.search', locale)"
                class="h-10 w-full rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 ps-9 pe-3 text-sm text-content outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
              />
            </div>

            <label class="sr-only" for="catalogue-order">
              {{ t('workshop.v2.sort.label', locale) }}
            </label>
            <select id="catalogue-order" v-model="order" :class="selectClass">
              <option
                v-for="option in ORDERS"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.label, locale) }}
              </option>
            </select>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div
              class="flex flex-wrap items-center gap-1 rounded-2xl bg-transparency-white-t4 p-1"
              data-testid="catalogue-type-facet"
            >
              <button
                v-for="option in TYPES"
                :key="option.value"
                type="button"
                :class="
                  cn(
                    'inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm transition-colors',
                    type === option.value
                      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                      : 'text-content-secondary hover:text-content-bright'
                  )
                "
                :data-active="type === option.value"
                @click="type = option.value"
              >
                {{ t(option.label, locale) }}
                <span class="text-2xs tabular-nums opacity-70">
                  {{ countOf(option.value) }}
                </span>
              </button>
            </div>

            <label class="sr-only" for="catalogue-needs">
              {{ t('workshop.v2.filter.needs', locale) }}
            </label>
            <select id="catalogue-needs" v-model="needs" :class="selectClass">
              <option
                v-for="option in NEEDS"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.label, locale) }}
              </option>
            </select>

            <label class="sr-only" for="catalogue-output">
              {{ t('workshop.v2.filter.output', locale) }}
            </label>
            <select id="catalogue-output" v-model="output" :class="selectClass">
              <option
                v-for="option in OUTPUTS"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.label, locale) }}
              </option>
            </select>

            <label class="sr-only" for="catalogue-provider">
              {{ t('workshop.v2.filter.provider', locale) }}
            </label>
            <select
              id="catalogue-provider"
              v-model="provider"
              :class="selectClass"
            >
              <option value="all">
                {{ t('workshop.v2.filter.allProviders', locale) }}
              </option>
              <option v-for="name in providers" :key="name" :value="name">
                {{ name }}
              </option>
            </select>
          </div>

          <div
            v-if="usesModel || narrowedBy || filtersOn"
            class="mt-3 flex flex-wrap items-center gap-2"
            data-testid="catalogue-chips"
          >
            <span v-if="usesModel" :class="chipClass">
              {{
                t('workshop.v2.card.runsOn', locale).replace(
                  '{model}',
                  usesModel
                )
              }}
              <button
                type="button"
                class="cursor-pointer text-content-muted hover:text-content-bright"
                :aria-label="t('workshop.v2.clear', locale)"
                @click="usesModel = ''"
              >
                <X class="size-3" />
              </button>
            </span>
            <span v-if="narrowedBy" :class="chipClass">
              {{
                t('workshop.v2.sort.narrowed', locale).replace(
                  '{type}',
                  t(
                    narrowedBy === 'model'
                      ? 'workshop.v2.kind.models'
                      : 'workshop.v2.kind.workflows',
                    locale
                  ).toLowerCase()
                )
              }}
            </span>
            <button
              v-if="filtersOn"
              type="button"
              class="cursor-pointer text-xs text-content-muted underline underline-offset-4 hover:text-content-bright"
              @click="clearFilters"
            >
              {{ t('workshop.v2.clear', locale) }}
            </button>
          </div>
        </div>

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
            :view="cardViewFor(entry, needsCustomNodes, priceBySlug)"
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
