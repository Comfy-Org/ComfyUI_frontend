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
import { computed, onMounted, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { groupModels } from '../../config/model-family'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  CapabilityGroup,
  LaunchGroup,
  ModalityFilter,
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/workshop'
import {
  SORT_ORDERS,
  parseCatalogSearch,
  CAPABILITY_GROUPS,
  CAPABILITY_GROUP_LABELS,
  MODALITIES,
  LAUNCH_GROUPS,
  capabilityGroupOf,
  launchGroupsOf,
  countByFacet,
  countByModality,
  modalityOf,
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import WorkshopSearchPanel from './WorkshopSearchPanel.vue'
import WorkshopSections from './WorkshopSections.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const useCase = ref<UseCase | 'all'>('all')
const modalities = ref<string[]>([])
const capabilities = ref<string[]>([])
const providers = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const searchOpen = ref(false)

// Focus moving to the clear button or into the panel itself is still inside
// the search, so only a move out of the wrapper closes it.
function closeSearchOnLeave(event: FocusEvent) {
  const wrapper = event.currentTarget
  const moved = event.relatedTarget
  if (
    wrapper instanceof HTMLElement &&
    (!(moved instanceof Node) || !wrapper.contains(moved))
  )
    searchOpen.value = false
}

const toggled = (list: readonly string[], value: string) =>
  list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value]
const { showStatuses, version, groupVersions } = usePrototypeTweaks()

onMounted(() => {
  const initial = parseCatalogSearch(location.search)
  query.value = initial.query ?? ''
  useCase.value = initial.useCase ?? 'all'
  capabilities.value = [...(initial.capabilities ?? [])]
  providers.value = [...(initial.providers ?? [])]
  modalities.value = [...(initial.modalities ?? [])]
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

// V1 keeps the row of tabs it shipped with; V1.2 is the same listing with the
// categories moved into a rail beside the grid.
const railBeside = computed(() => version.value === 'v1.2')

const railLabel: TranslationKey = 'workshop.launch.label'

const launch = ref<LaunchGroup | 'all'>('all')

const launchLabelKey: Record<LaunchGroup | 'all', TranslationKey> = {
  all: 'workshop.launch.all',
  create: 'workshop.launch.create',
  edit: 'workshop.launch.edit',
  specialized: 'workshop.launch.specialized'
}

// No counts: a model that both creates and edits belongs to two of these, so
// any total shown here would be larger than the catalogue.
const rail = computed(() =>
  (['all', ...LAUNCH_GROUPS] as const).map((value) => ({
    value,
    label: launchLabelKey[value],
    current: launch.value === value
  }))
)

function selectRail(value: LaunchGroup | 'all') {
  launch.value = value
}
// The tabs carry the taxonomy's top layer and the filter its second, so the
// filter only offers the groups that belong to the tab in front.
const GROUPS_PER_TAB: Record<LaunchGroup, readonly CapabilityGroup[]> = {
  create: ['createImages', 'createVideos'],
  edit: ['editImages', 'editVideos', 'enhance'],
  specialized: ['identity', 'other']
}

// Ordered by group so the filter can show where each block begins.
const capabilityOptions = computed<FacetMenuOption[]>(() => {
  const order = CAPABILITY_GROUPS.map((group) => group.key)
  return countByFacet(models, 'capabilities')
    .map((option) => ({
      ...option,
      label: option.value,
      group: capabilityGroupOf(option.value)
    }))
    .filter(
      (option) =>
        launch.value === 'all' ||
        GROUPS_PER_TAB[launch.value].includes(option.group)
    )
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
})

// A selection the tab no longer offers would keep narrowing the grid from
// somewhere the visitor cannot see.
watch(launch, () => {
  const offered = new Set(capabilityOptions.value.map((option) => option.value))
  capabilities.value = capabilities.value.filter((value) => offered.has(value))
})
// Beside the grid the categories are open rather than behind a button, so the
// group each capability belongs to has to be drawn on the first of its run.
const railCategories = computed(() =>
  capabilityOptions.value.map((option, index) => ({
    ...option,
    startsGroup: option.group !== capabilityOptions.value[index - 1]?.group
  }))
)

function toggleCapability(value: string) {
  capabilities.value = capabilities.value.includes(value)
    ? capabilities.value.filter((capability) => capability !== value)
    : [...capabilities.value, value]
}

const providerOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(models, 'provider').map((option) => ({
    ...option,
    label: option.value
  }))
)
// What a model puts out stays reachable, one level below the tabs.
const modalityOptions = computed<FacetMenuOption[]>(() => {
  const counts = countByModality(models)
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

const inLaunchGroup = (model: WorkshopModel) =>
  launch.value === 'all' || launchGroupsOf(model).includes(launch.value)

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
      })
        .filter(inLaunchGroup)
        .filter(inModality),
      sort.value
    ),
    groupVersions.value
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
  modalities.value = []
  capabilities.value = []
  providers.value = []
}

const tabClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    railBeside.value &&
      'lg:w-full lg:justify-between lg:rounded-xl lg:border-b-0 lg:px-3 lg:py-2.5',
    current
      ? cn(
          'border-primary-comfy-yellow text-primary-warm-white',
          railBeside.value && 'lg:bg-transparency-white-t8'
        )
      : cn(
          'border-transparent text-primary-warm-gray hover:text-primary-warm-white',
          railBeside.value && 'lg:hover:bg-transparency-white-t4'
        )
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
    :key="version"
    :class="
      cn(
        'gap-10',
        railBeside && !browsing && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]'
      )
    "
  >
    <aside
      v-if="!browsing"
      :class="
        railBeside &&
        'lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:scrollbar-thin lg:self-start lg:overflow-y-auto'
      "
    >
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
          {{
            t(
              railBeside && entry.value === 'all'
                ? 'workshop.launch.allUseCases'
                : entry.label,
              locale
            )
          }}
        </button>
      </nav>

      <div
        v-if="railBeside"
        class="mt-8 hidden flex-col lg:flex"
        data-testid="rail-categories"
      >
        <template v-for="option in railCategories" :key="option.value">
          <p
            v-if="option.startsGroup && option.group"
            class="mt-5 px-2 pb-1 text-2xs font-bold tracking-wider text-primary-warm-gray uppercase first:mt-0"
          >
            {{ t(CAPABILITY_GROUP_LABELS[option.group], locale) }}
          </p>
          <button
            type="button"
            role="checkbox"
            :aria-checked="capabilities.includes(option.value)"
            :data-testid="`rail-capability-${option.value}`"
            class="hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-primary-comfy-canvas outline-none"
            @click="toggleCapability(option.value)"
          >
            <span
              :class="
                cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                  capabilities.includes(option.value)
                    ? 'border-brand bg-brand text-page'
                    : 'border-white/25'
                )
              "
              aria-hidden="true"
            >
              <Check
                v-if="capabilities.includes(option.value)"
                class="size-3"
                :stroke-width="3"
              />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
            <span class="shrink-0 text-primary-warm-gray tabular-nums">
              {{ option.count }}
            </span>
          </button>
        </template>
      </div>
    </aside>

    <div class="min-w-0">
      <div
        class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="relative w-full lg:max-w-xl" @focusout="closeSearchOnLeave">
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
            role="combobox"
            aria-controls="workshop-search-panel"
            :aria-expanded="searchOpen"
            @focus="searchOpen = true"
            @keydown.escape="searchOpen = false"
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

          <WorkshopSearchPanel
            v-if="searchOpen"
            id="workshop-search-panel"
            :models
            :query
            :providers
            :capabilities
            :locale
            @pick="(model) => (query = model.name)"
            @toggle-provider="
              (value) => (providers = toggled(providers, value))
            "
            @toggle-capability="
              (value) => (capabilities = toggled(capabilities, value))
            "
          />
        </div>

        <div class="flex flex-wrap gap-2" data-testid="workshop-filters">
          <WorkshopFilterMenu
            v-model:capabilities="capabilities"
            v-model:providers="providers"
            v-model:modalities="modalities"
            :capability-options="capabilityOptions"
            :provider-options="providerOptions"
            :modality-options="modalityOptions"
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
                  : 'min-[2200px]:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4'
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
