<script setup lang="ts">
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { useMediaQuery } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { useSlidingUnderline } from '../../composables/useSlidingUnderline'
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
  USE_CASES,
  countByFacet,
  countByModality,
  countByUseCase,
  modalityOf,
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '../../config/workshop-sections'
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
const { version, showFeatured } = usePrototypeTweaks()

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

// V1 keeps the row of tabs it shipped with; V1.2 is the same listing with the
// categories moved into a rail beside the grid.
const railBeside = computed(() => version.value === 'v1.2')

const railLabel: TranslationKey = 'workshop.launch.label'

// The same shelves the browsing rows show, in the catalogue's own reading
// order: text, 3D and audio share one "Other formats" entry, and a use case
// nothing falls into drops out. All is not a seventh category, it is no
// category selected, which is why the rows are what it renders.
const rail = computed(() => {
  const counts = countByUseCase(models)
  const otherCount = OTHER_FORMAT_USE_CASES.reduce(
    (total, value) => total + counts[value],
    0
  )
  return [
    { value: 'all' as const, count: models.length },
    ...USE_CASES.filter(
      (value) => !OTHER_FORMAT_USE_CASES.includes(value) && counts[value] > 0
    ).map((value) => ({ value, count: counts[value] })),
    ...(otherCount > 0 ? [{ value: 'other' as const, count: otherCount }] : [])
  ].map((entry) => ({
    ...entry,
    label: t(useCaseLabelKey[entry.value], locale),
    current: useCase.value === entry.value
  }))
})

const onPhone = useMediaQuery('(max-width: 639px)')

const useCaseOptions = computed<FacetMenuOption[]>(() =>
  rail.value.map(({ value, label, count }) => ({ value, label, count }))
)

const chosenUseCase = computed<string[]>({
  get: () => (useCase.value === 'all' ? [] : [useCase.value]),
  set: (values) => {
    const last = values.at(-1)
    const match = rail.value.find((entry) => entry.value === last)
    selectRail(match?.value ?? 'all')
  }
})

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

const inModality = (model: WorkshopModel) =>
  modalities.value.length === 0 || modalities.value.includes(modalityOf(model))

const visible = computed(() =>
  groupModels(
    sortWorkshopModels(
      filterWorkshopModels(models, {
        query: query.value,
        useCase: useCase.value,
        providers: providers.value,
        capabilities: capabilities.value
      }).filter(inModality),
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
const browseAll = defineModel<boolean>('browseAll', { default: false })
const browsing = computed(
  () => version.value === 'v1.1' && !isFiltered.value && !browseAll.value
)
// The browsing rows are the use cases, each with its name and its count, so a
// row of chips saying the same six words would be the same list twice. V1.1
// leaves a category the way it entered one, through its own header.
const showRail = computed(() => version.value !== 'v1.1')
const inSection = computed(
  () => version.value === 'v1.1' && (useCase.value !== 'all' || browseAll.value)
)
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
// V1.1 enters a category from its row and leaves it from its header, so the
// use case is a place rather than a checkbox and the menu does not repeat it.
// The other versions carry it wherever their rail is not on screen.
const useCasesInFilter = computed(
  () => showRail.value && onPhone.value && railBeside.value
)

// Router reports no curated set yet, so the banner that opens the listing
// carries the catalogue's own most-run models and costs nothing to keep true
// as the catalogue grows.
const FEATURED_LIMIT = 6
const featured = computed(() =>
  sortWorkshopModels(models, 'popular').slice(0, FEATURED_LIMIT)
)

function openSection(value: UseCase | 'other') {
  useCase.value = value
}

function leaveSection() {
  browseAll.value = false
  selectRail('all')
}

function resetFilters() {
  query.value = ''
  useCase.value = 'all'
  modalities.value = []
  capabilities.value = []
  providers.value = []
}

function clearFilters() {
  browseAll.value = false
  resetFilters()
}

// The whole catalogue is the whole catalogue, whatever was typed before.
watch(browseAll, (on) => on && resetFilters())

const tabClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    railBeside.value &&
      'lg:w-full lg:justify-between lg:rounded-xl lg:px-3 lg:py-2.5',
    current
      ? cn(
          'text-primary-warm-white',
          railBeside.value && 'lg:bg-transparency-white-t8'
        )
      : cn(
          'text-primary-warm-gray hover:text-primary-warm-white',
          railBeside.value && 'lg:hover:bg-transparency-white-t4'
        )
  )

const navRef = useTemplateRef<HTMLElement>('nav')
const underline = useSlidingUnderline(navRef, () => [useCase.value, rail.value])

const menuItemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t4'
</script>

<template>
  <section
    :key="version"
    :class="
      cn(
        'gap-10',
        railBeside && !browsing && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]'
      )
    "
  >
    <FeaturedBanner
      v-if="browsing && showFeatured && featured.length"
      :models="featured"
      :locale
      class="short:mb-6 mb-10"
    />

    <aside
      v-if="showRail"
      :class="
        railBeside &&
        'lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:scrollbar-thin lg:self-start lg:overflow-y-auto lg:pt-4'
      "
    >
      <nav
        ref="nav"
        :class="
          cn(
            'relative mb-8 flex gap-8 overflow-x-auto border-b border-transparency-white-t8 max-sm:mb-4',
            railBeside && 'max-sm:hidden',
            railBeside &&
              'lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0'
          )
        "
        :aria-label="t(railLabel, locale)"
        data-testid="workshop-use-cases"
      >
        <span
          aria-hidden="true"
          :class="
            cn(
              'pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary-warm-white transition-[translate,width] duration-300 ease-out',
              railBeside && 'lg:hidden'
            )
          "
          :style="{
            translate: `${underline.left}px 0`,
            width: `${underline.width}px`
          }"
        />
        <button
          v-for="entry in rail"
          :key="entry.value"
          type="button"
          :aria-pressed="entry.current"
          :data-testid="`use-case-${entry.value}`"
          :class="tabClass(entry.current)"
          @click="selectRail(entry.value)"
        >
          <span class="min-w-0 truncate">{{ entry.label }}</span>
        </button>
      </nav>
    </aside>

    <div class="min-w-0">
      <button
        v-if="inSection"
        type="button"
        class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 -ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3"
        data-testid="section-back"
        @click="leaveSection"
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
            v-model:use-cases="chosenUseCase"
            :capability-options="capabilityOptions"
            :provider-options="providerOptions"
            :modality-options="modalityOptions"
            :use-case-options="useCasesInFilter ? useCaseOptions : undefined"
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
          class="group hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 mt-12 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none focus-visible:ring-3"
          data-testid="browse-all-end"
          @click="browseAll = true"
        >
          {{ t('workshop.sections.browseAll', locale) }}
          <span class="text-primary-warm-gray tabular-nums">
            {{ visible.length }}
          </span>
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
            :class="
              cn(
                'grid grid-cols-1 gap-5 sm:grid-cols-2',
                railBeside
                  ? 'xl:grid-cols-3 2xl:grid-cols-4'
                  : 'lg:grid-cols-3 xl:grid-cols-4'
              )
            "
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
