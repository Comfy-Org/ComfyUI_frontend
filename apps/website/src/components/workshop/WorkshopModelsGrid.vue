<script setup lang="ts">
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  Search,
  X
} from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { groupByFamily } from '../../config/model-family'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  ModalityFilter,
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/workshop'
import {
  MODALITIES,
  SORT_ORDERS,
  USE_CASES,
  countByModality,
  parseCatalogSearch,
  countByFacet,
  countByUseCase,
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import WorkshopSections from './WorkshopSections.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const useCase = ref<UseCase | 'all'>('all')
const modality = ref<ModalityFilter>('all')
const capabilities = ref<string[]>([])
const providers = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const { showStatuses, version } = usePrototypeTweaks()

onMounted(() => {
  const initial = parseCatalogSearch(location.search)
  query.value = initial.query ?? ''
  useCase.value = initial.useCase ?? 'all'
  capabilities.value = [...(initial.capabilities ?? [])]
  providers.value = [...(initial.providers ?? [])]
})

const useCaseLabelKey: Record<UseCase | 'all', TranslationKey> = {
  all: 'workshop.useCase.all',
  'generate-images': 'workshop.useCase.generateImages',
  'edit-images': 'workshop.useCase.editImages',
  'generate-videos': 'workshop.useCase.generateVideos',
  'animate-images': 'workshop.useCase.animateImages',
  'edit-videos': 'workshop.useCase.editVideos',
  '3d': 'workshop.useCase.3d',
  audio: 'workshop.useCase.audio',
  text: 'workshop.useCase.text'
}
const mediaLabelKey: Record<ModalityFilter, TranslationKey> = {
  all: 'workshop.useCase.all',
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}
const sortLabelKey: Record<SortOrder, TranslationKey> = {
  popular: 'workshop.sort.popular',
  name: 'workshop.sort.name',
  priceAsc: 'workshop.sort.priceAsc',
  priceDesc: 'workshop.sort.priceDesc'
}

const counts = computed(() => countByUseCase(models))
const useCases = computed(() =>
  (['all', ...USE_CASES] as const).filter((value) => counts.value[value] > 0)
)
const mediaCounts = computed(() => countByModality(models))
const media = computed(() =>
  (['all', ...MODALITIES] as const).filter(
    (value) => mediaCounts.value[value] > 0
  )
)

// The listing browses by what a model makes; V1.1's rows stay on the use cases
// they were built around.
// V1 keeps the row of tabs it shipped with; V1.2 is the same listing with the
// categories moved into a rail beside the grid.
const railBeside = computed(() => version.value === 'v1.2')

const railLabel = computed<TranslationKey>(() =>
  version.value === 'v1.1' ? 'workshop.useCase.label' : 'workshop.media.label'
)

const rail = computed(() =>
  version.value === 'v1.1'
    ? useCases.value.map((value) => ({
        value,
        label: useCaseLabelKey[value],
        count: counts.value[value],
        current: useCase.value === value
      }))
    : media.value.map((value) => ({
        value,
        label: mediaLabelKey[value],
        count: mediaCounts.value[value],
        current: modality.value === value
      }))
)

function selectRail(value: (typeof rail.value)[number]['value']) {
  if (version.value === 'v1.1') useCase.value = value as UseCase | 'all'
  else modality.value = value as ModalityFilter
}
const capabilityOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(models, 'capabilities').map((option) => ({
    ...option,
    label: option.value
  }))
)
const providerOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(models, 'provider').map((option) => ({
    ...option,
    label: option.value
  }))
)

const visible = computed(() =>
  groupByFamily(
    sortWorkshopModels(
      filterWorkshopModels(models, {
        query: query.value,
        useCase: useCase.value,
        modality: modality.value,
        providers: providers.value,
        capabilities: capabilities.value
      }),
      sort.value
    )
  )
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    useCase.value !== 'all' ||
    modality.value !== 'all' ||
    capabilities.value.length + providers.value.length > 0
)

// Willie's browseable listing: rows per use case until the visitor narrows
// down, then the flat grid takes over.
const browsing = computed(
  () =>
    version.value === 'v1.1' &&
    query.value === '' &&
    useCase.value === 'all' &&
    capabilities.value.length + providers.value.length === 0
)
const inSection = computed(
  () => version.value === 'v1.1' && useCase.value !== 'all'
)
const sectionProviders = computed<FacetMenuOption[]>(() =>
  countByFacet(
    filterWorkshopModels(models, { useCase: useCase.value }),
    'provider'
  ).map((option) => ({ ...option, label: option.value }))
)

function openSection(value: UseCase) {
  useCase.value = value
}

function toggleProvider(value: string) {
  providers.value = providers.value.includes(value)
    ? providers.value.filter((provider) => provider !== value)
    : [value]
}

function clearFilters() {
  query.value = ''
  useCase.value = 'all'
  modality.value = 'all'
  capabilities.value = []
  providers.value = []
}

const tabClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    'lg:w-full lg:justify-between lg:rounded-xl lg:border-b-0 lg:px-3 lg:py-2.5',
    current
      ? 'border-primary-comfy-yellow text-primary-warm-white lg:bg-transparency-white-t8'
      : 'lg:hover:bg-transparency-white-t4 border-transparent text-primary-warm-gray hover:text-primary-warm-white'
  )

const chipClass = (active: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex h-9 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm transition-colors outline-none focus-visible:ring-3',
    active
      ? 'border-primary-comfy-yellow text-primary-warm-white'
      : 'border-transparency-white-t20 text-primary-comfy-canvas hover:text-primary-warm-white'
  )

const menuItemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t8'
</script>

<template>
  <section
    :class="
      cn('gap-10', !browsing && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]')
    "
  >
    <aside
      v-if="!browsing"
      class="lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:scrollbar-thin lg:self-start lg:overflow-y-auto"
    >
      <h2
        class="mb-3 hidden text-xs font-bold tracking-wider text-primary-warm-gray uppercase lg:block"
      >
        {{ t(railLabel, locale) }}
      </h2>
      <nav
        :class="
          cn(
            'mb-8 flex gap-8 overflow-x-auto border-b border-transparency-white-t8',
            railBeside &&
              'lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0'
          )
        "
        :aria-label="t(railLabel, locale)"
        data-testid="workshop-use-cases"
      >
        <button
          v-for="entry in rail"
          :key="entry.value"
          type="button"
          :aria-pressed="entry.current"
          :data-testid="`use-case-${entry.value}`"
          :class="tabClass(entry.current)"
          @click="selectRail(entry.value)"
        >
          {{ t(entry.label, locale) }}
          <span class="text-xs text-primary-warm-gray tabular-nums">
            {{ entry.count }}
          </span>
        </button>
      </nav>
    </aside>

    <div class="min-w-0">
      <div
        class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="relative w-full lg:max-w-md">
          <label for="workshop-search" class="sr-only">
            {{ t('workshop.search.label', locale) }}
          </label>
          <Search
            class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
            aria-hidden="true"
          />
          <input
            id="workshop-search"
            v-model="query"
            type="search"
            :placeholder="t('workshop.search.label', locale)"
            data-testid="workshop-search"
            class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            v-if="query"
            type="button"
            :aria-label="t('workshop.search.clear', locale)"
            data-testid="workshop-search-clear"
            class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
            @click="query = ''"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>

        <div class="flex flex-wrap gap-2" data-testid="workshop-filters">
          <WorkshopFilterMenu
            v-model:capabilities="capabilities"
            v-model:providers="providers"
            :capability-options="capabilityOptions"
            :provider-options="providerOptions"
            :locale
          />

          <DropdownMenuRoot>
            <DropdownMenuTrigger
              data-testid="workshop-sort"
              :aria-label="t('workshop.sort.label', locale)"
              class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 group inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3"
            >
              <ArrowUpDown class="size-4" aria-hidden="true" />
              {{ t(sortLabelKey[sort], locale) }}
              <ChevronDown
                class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                align="end"
                :side-offset="8"
                class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-64 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
              >
                <DropdownMenuRadioGroup v-model="sort">
                  <DropdownMenuRadioItem
                    v-for="order in SORT_ORDERS"
                    :key="order"
                    :value="order"
                    :data-testid="`sort-${order}`"
                    :class="menuItemClass"
                  >
                    <span
                      :class="
                        cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                          sort === order
                            ? 'border-brand bg-brand text-page'
                            : 'border-white/25'
                        )
                      "
                      aria-hidden="true"
                    >
                      <Check
                        v-if="sort === order"
                        class="size-3"
                        :stroke-width="3"
                      />
                    </span>
                    <span class="flex-1">{{
                      t(sortLabelKey[order], locale)
                    }}</span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>

      <WorkshopSections
        v-if="browsing"
        :models
        :label-key="useCaseLabelKey"
        :sort
        :locale
        :show-statuses="showStatuses"
        @open="openSection"
      />

      <template v-else>
        <button
          v-if="inSection"
          type="button"
          class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 mb-6 inline-flex cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none focus-visible:ring-3"
          data-testid="section-back"
          @click="clearFilters"
        >
          <ChevronLeft class="size-4" aria-hidden="true" />
          {{ t('workshop.sections.back', locale) }}
        </button>

        <div
          v-if="inSection"
          class="mb-6 flex flex-wrap items-center gap-2"
          data-testid="section-providers"
        >
          <button
            type="button"
            :aria-pressed="providers.length === 0"
            :class="chipClass(providers.length === 0)"
            data-testid="section-provider-all"
            @click="providers = []"
          >
            {{ t('workshop.sections.provider', locale) }}
            <span class="tabular-nums opacity-60">{{ counts[useCase] }}</span>
          </button>
          <button
            v-for="option in sectionProviders"
            :key="option.value"
            type="button"
            :aria-pressed="providers.includes(option.value)"
            :class="chipClass(providers.includes(option.value))"
            :data-testid="`section-provider-${option.value}`"
            @click="toggleProvider(option.value)"
          >
            {{ option.label }}
            <span class="tabular-nums opacity-60">{{ option.count }}</span>
          </button>
        </div>

        <div v-if="visible.length">
          <h2 id="workshop-models-heading" class="sr-only">
            {{ t('workshop.models.heading', locale) }}
          </h2>
          <ul
            :class="
              cn(
                'grid grid-cols-1 gap-5 sm:grid-cols-2',
                railBeside
                  ? 'xl:grid-cols-3 2xl:grid-cols-4'
                  : 'lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              )
            "
            aria-labelledby="workshop-models-heading"
            data-testid="workshop-models-grid"
          >
            <li v-for="family in visible" :key="family.key">
              <WorkshopModelCard
                :model="family.latest"
                :version-count="family.versions.length"
                :locale
                :show-status="showStatuses"
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
