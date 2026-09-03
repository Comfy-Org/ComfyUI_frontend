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
import { cn } from '@comfyorg/tailwind-utils'

import type { SortOrder, UseCase, WorkshopModel } from '../../config/workshop'
import {
  SORT_ORDERS,
  USE_CASES,
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
  sortWorkshopModels(
    filterWorkshopModels(models, {
      query: query.value,
      useCase: useCase.value,
      providers: providers.value,
      capabilities: capabilities.value
    }),
    sort.value
  )
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    useCase.value !== 'all' ||
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
  capabilities.value = []
  providers.value = []
}

const tabClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    current
      ? 'border-primary-comfy-yellow text-primary-warm-white'
      : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
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
  <section>
    <nav
      v-if="!browsing"
      class="mb-8 flex gap-8 overflow-x-auto border-b border-transparency-white-t8"
      :aria-label="t('workshop.useCase.label', locale)"
      data-testid="workshop-use-cases"
    >
      <button
        v-for="value in useCases"
        :key="value"
        type="button"
        :aria-pressed="useCase === value"
        :data-testid="`use-case-${value}`"
        :class="tabClass(useCase === value)"
        @click="useCase = value"
      >
        {{ t(useCaseLabelKey[value], locale) }}
        <span class="text-xs text-primary-warm-gray tabular-nums">
          {{ counts[value] }}
        </span>
      </button>
    </nav>

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
          class="bg-transparency-white-t4 focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl border border-transparency-white-t20 pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
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
            class="hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t20 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none focus-visible:ring-3"
          >
            <ArrowUpDown class="size-4" aria-hidden="true" />
            {{ t(sortLabelKey[sort], locale) }}
            <ChevronDown class="size-4" aria-hidden="true" />
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
                  <span class="flex-1">{{
                    t(sortLabelKey[order], locale)
                  }}</span>
                  <Check
                    v-if="sort === order"
                    class="text-primary-comfy-yellow size-4"
                    aria-hidden="true"
                  />
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
          class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-labelledby="workshop-models-heading"
          data-testid="workshop-models-grid"
        >
          <li v-for="model in visible" :key="model.slug">
            <WorkshopModelCard :model :locale :show-status="showStatuses" />
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
  </section>
</template>
