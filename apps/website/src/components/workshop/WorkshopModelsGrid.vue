<script setup lang="ts">
import { ArrowUpDown, ChevronDown, ChevronLeft } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { groupModels } from '../../config/model-family'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  ModalityFilter,
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/models-catalogue'
import {
  SORT_ORDERS,
  parseCatalogSearch,
  MODALITIES,
  countByFacet,
  countByModality,
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/models-catalogue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSections from './WorkshopSections.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
// 'other' is the shelf the browsing rows show for text, 3D and audio at once.
const useCase = ref<UseCase | 'all' | 'other'>('all')
const modalities = ref<string[]>([])
const capabilities = ref<string[]>([])
const providers = ref<string[]>([])
const sort = ref<SortOrder>('popular')

onMounted(() => {
  const initial = parseCatalogSearch(location.search)
  query.value = initial.query ?? ''
  useCase.value = initial.useCase ?? 'all'
  capabilities.value = [...(initial.capabilities ?? [])]
  providers.value = [...(initial.providers ?? [])]
  modalities.value = [...(initial.modalities ?? [])]
})

// A row title clicked far down the page opens a much shorter screen, which
// would otherwise leave the viewport parked on the footer.
watch(useCase, () => void nextTick(() => window.scrollTo({ top: 0 })))

const useCaseLabelKey: Record<UseCase | 'all' | 'other', TranslationKey> = {
  all: 'workshop.useCase.all',
  other: 'workshop.sections.otherFormats',
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

function selectRail(value: UseCase | 'all' | 'other') {
  useCase.value = value
}

// A facet answers "what else is in here", so it counts what the category
// holds rather than what the whole catalogue holds.
const withinSection = computed(() =>
  filterWorkshopModels(models, { useCase: useCase.value })
)

const capabilityOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(withinSection.value, 'capabilities').map((option) => ({
    ...option,
    label: option.value
  }))
)
const providerOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(withinSection.value, 'provider').map((option) => ({
    ...option,
    label: option.value
  }))
)
// What a model puts out stays reachable, one level below the tabs.
const modalityOptions = computed<FacetMenuOption[]>(() => {
  const counts = countByModality(withinSection.value)
  return MODALITIES.filter((value) => counts[value] > 0).map((value) => ({
    value,
    label: t(modalityLabelKey[value], locale),
    count: counts[value]
  }))
})
const modalityLabelKey: Record<
  Exclude<ModalityFilter, 'all'>,
  TranslationKey
> = {
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}

const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      filterWorkshopModels(models, {
        query: query.value,
        useCase: useCase.value,
        providers: providers.value,
        capabilities: capabilities.value,
        modalities: modalities.value
      }),
      sort.value
    )
  )
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    useCase.value !== 'all' ||
    capabilities.value.length +
      providers.value.length +
      modalities.value.length >
      0
)

// Willie's browseable listing: rows per use case until the visitor narrows
// down, then the flat grid takes over.
const browsing = computed(() => !isFiltered.value)
// The browsing rows are the use cases, each with its name and its count, so a
// row of chips saying the same six words would be the same list twice. V1.1
// leaves a category the way it entered one, through its own header.
const inSection = computed(() => useCase.value !== 'all')
const sectionTitleKey = computed<TranslationKey>(() =>
  useCase.value === 'other'
    ? 'workshop.sections.otherFormats'
    : useCaseLabelKey[useCase.value]
)

// A category names the screen it opens, so the page heading above it would say
// the catalogue's name twice.
const emit = defineEmits<{ section: [boolean] }>()
watch(inSection, (value) => emit('section', value), { immediate: true })

// Router reports no curated set yet, so the banner that opens the listing
// carries the catalogue's own most-run models and costs nothing to keep true
// as the catalogue grows.
const FEATURED_LIMIT = 6
const FEATURED_SLUGS = [
  'byteplus--seedance-2-fast-text-to-video--generate-videos',
  'bfl--flux-3-text-to-video--generate-videos'
]
const featured = computed(() => {
  const available = sortWorkshopModels(models, 'popular').filter(
    (model) => model.thumbnailUrl
  )
  const selected = FEATURED_SLUGS.flatMap((slug) =>
    available.filter((model) => model.slug === slug)
  )
  return [
    ...selected,
    ...available.filter((model) => !FEATURED_SLUGS.includes(model.slug))
  ].slice(0, FEATURED_LIMIT)
})

function openSection(value: UseCase | 'other') {
  useCase.value = value
}

function clearFilters() {
  query.value = ''
  useCase.value = 'all'
  modalities.value = []
  capabilities.value = []
  providers.value = []
}

const menuItemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t4'
</script>

<template>
  <section class="gap-10">
    <FeaturedBanner
      v-if="browsing && featured.length"
      :models="featured"
      :locale
      class="mb-10"
    />

    <div class="min-w-0">
      <button
        v-if="inSection"
        type="button"
        class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 -ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3"
        data-testid="section-back"
        @click="selectRail('all')"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back', locale) }}
      </button>

      <div
        class="bg-page sticky top-20 z-30 mb-8 flex flex-wrap items-center justify-end gap-3 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      >
        <h1
          v-if="inSection"
          class="mr-auto text-3xl font-bold text-primary-warm-white max-sm:w-full sm:text-4xl"
        >
          {{ t(sectionTitleKey, locale) }}
          <span
            class="text-base font-normal text-primary-warm-gray tabular-nums"
          >
            {{ visible.length }}
          </span>
        </h1>

        <WorkshopSearchField
          v-model="query"
          v-model:providers="providers"
          v-model:capabilities="capabilities"
          :models
          :locale
          compact
          :class="
            cn(
              'max-sm:min-w-0 max-sm:flex-1 sm:w-full sm:max-w-xl',
              !inSection && 'sm:mr-auto'
            )
          "
        />

        <div class="flex items-center gap-2" data-testid="workshop-filters">
          <WorkshopFilterMenu
            v-model:capabilities="capabilities"
            v-model:providers="providers"
            v-model:modalities="modalities"
            :capability-options="capabilityOptions"
            :provider-options="providerOptions"
            :modality-options="modalityOptions"
            :result-count="visible.length"
            :locale
          />

          <DropdownMenuRoot>
            <DropdownMenuTrigger
              data-testid="workshop-sort"
              :aria-label="t('workshop.sort.label', locale)"
              class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 group inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 max-sm:size-10 max-sm:justify-center max-sm:rounded-xl max-sm:bg-white/8 max-sm:px-0"
            >
              <ArrowUpDown class="size-4 shrink-0" aria-hidden="true" />
              <span class="max-sm:hidden">{{
                t(sortLabelKey[sort], locale)
              }}</span>
              <ChevronDown
                class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180 max-sm:hidden"
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
                    :class="
                      cn(
                        menuItemClass,
                        sort === order &&
                          'bg-transparency-white-t8 text-primary-warm-white'
                      )
                    "
                  >
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
        @open="openSection"
      />

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
              <WorkshopModelCard :model="family.latest" :locale />
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
