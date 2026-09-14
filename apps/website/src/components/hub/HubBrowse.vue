<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FilterBadgeType } from '../../composables/useHubStore'
import { useHubStore } from '../../composables/useHubStore'
import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import {
  USE_CASES,
  sortWorkshopModels,
  useCaseFor
} from '../../config/models-catalogue'
import { groupModels } from '../../config/model-family'
import hubTemplates from '../../data/hubTemplates.json'
import { templatePath } from '../../lib/hub/workflow-detail'
import { modelNamesMatching } from '../../lib/hub/template-use-case'
import { tagDisplayName } from '../../lib/hub/tag-aliases'
import { withFacetFields } from '../../lib/hub/facet-fields'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type {
  FacetGroupConfig,
  SortOption,
  ToolbarLabels
} from './BrowseToolbar.vue'
import HubUseCaseNav from './HubUseCaseNav.vue'
import type { GridLabels } from './WorkflowGrid.vue'
import WorkflowGrid from './WorkflowGrid.vue'
import WorkshopHero from '../workshop/WorkshopHero.vue'
import WorkshopModelCard from '../workshop/WorkshopModelCard.vue'
import WorkshopSearchField from '../workshop/WorkshopSearchField.vue'

const {
  models,
  locale = 'en',
  embedded = false,
  withModels = true
} = defineProps<{
  /** Resolved on the server: the catalogue JSON must not reach a client
   * bundle, so the page hands the island the models it needs. */
  models: readonly WorkshopModel[]
  locale?: Locale
  embedded?: boolean
  /** Models have their own screen. A workflows-only browse drops the Models
   * tab and the model cards, and keeps everything else: the same use cases,
   * the same toolbar, the same search. */
  withModels?: boolean
}>()

const templates = (hubTemplates as HubTemplate[]).map((template) =>
  withFacetFields(template, models)
)
const store = useHubStore()

// The use cases read as a rail beside the grid, the way the models listing
// does. Embedded elsewhere the hub is a grid on its own, without them.
const railBeside = computed(() => !embedded)
onUnmounted(() => store.reset())

const ALL_TABS = ['all', 'nodeGraphs', 'comfyApps', 'models'] as const
const TABS = withModels
  ? ALL_TABS
  : (ALL_TABS.filter(
      (tab) => tab !== 'models'
    ) as readonly (typeof ALL_TABS)[number][])

// The hub browses by what a thing makes, the same axis and the same vocabulary
// as the models list, so a workflow and a model answer to the same use case.
const useCase = ref<UseCase | 'all'>('all')

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

// Arriving from the home row means "show me this provider": the models it makes
// and the workflows that run them. The search panel narrows the same two lists,
// by provider and by what a model can do.
const providers = ref<string[]>([])
const capabilities = ref<string[]>([])

const narrowed = computed(
  () => providers.value.length + capabilities.value.length > 0
)

function clearSearchFilters() {
  providers.value = []
  capabilities.value = []
}

const matchesModel = (model: WorkshopModel) =>
  (providers.value.length === 0 ||
    (model.provider !== undefined &&
      providers.value.includes(model.provider))) &&
  (capabilities.value.length === 0 ||
    capabilities.value.some((capability) =>
      model.capabilities.includes(capability)
    ))

// A workflow answers to the same narrowing through the models it runs.
const matchingModelNames = computed(
  () =>
    new Set(
      models.filter(matchesModel).map((model) => model.name.toLowerCase())
    )
)

const runsMatchingModel = (tmpl: HubTemplate) =>
  !narrowed.value ||
  tmpl.models.some((name) => matchingModelNames.value.has(name.toLowerCase()))

const inUseCase = (value: UseCase | 'all') => ({
  models: withModels
    ? models.filter(
        (model) =>
          (value === 'all' || useCaseFor(model) === value) &&
          matchesModel(model)
      )
    : [],
  templates: templates.filter(
    (tmpl) =>
      (value === 'all' || tmpl.useCase === value) && runsMatchingModel(tmpl)
  )
})

const totalIn = (value: UseCase | 'all') => {
  const { models, templates: scoped } = inUseCase(value)
  return groupModels(models).length + scoped.length
}

// In the catalogue's reading order, and without printing the tally: the row
// names use cases, it is not a report.
const useCaseTabs = computed(() =>
  ['all' as const, ...USE_CASES.filter((value) => totalIn(value) > 0)].map(
    (value) => ({ value, label: t(useCaseLabelKey[value], locale) })
  )
)

const scoped = computed(() => inUseCase(useCase.value))

onMounted(() => {
  const params = new URLSearchParams(location.search)
  const tab = TABS.find((value) => value === params.get('tab'))
  if (tab) store.setTab(tab)
  const wanted = USE_CASES.find((value) => value === params.get('useCase'))
  if (wanted) useCase.value = wanted
  const asked = params.get('provider')
  if (asked) providers.value = [asked]
  const tag = params.get('tag')
  if (tag) store.toggleBadge({ type: 'tag', value: tag })
  const model = params.get('model')
  if (model)
    for (const value of modelNamesMatching(model, templates))
      store.toggleBadge({ type: 'model', value })
  const query = params.get('q')
  if (query) store.searchQuery.value = query
})

const toolbarLabels: ToolbarLabels = {
  all: t('workshop.hub.kind.all', locale),
  nodeGraphs: t('workshop.hub.kind.graph', locale),
  comfyApps: t('workshop.hub.kind.app', locale),
  models: t('workshop.hub.kind.models', locale),
  filter: t('workshop.filter.label', locale),
  clearAll: t('workshop.hub.facets.clearAll', locale),
  searchPlaceholder: t('workshop.hub.facets.search', locale),
  noResults: t('workshop.hub.facets.noResults', locale),
  typeAll: t('workshop.hub.kind.all', locale),
  less: t('workshop.hub.facets.less', locale),
  selected: t('workshop.hub.facets.selected', locale),
  showResults: t('workshop.hub.facets.show', locale),
  showModels: t('workshop.search.show', locale),
  resize: t('workshop.filter.resize', locale)
}
// Workflows are dated and models are priced, so a tab offers what the things
// it lists can actually be ordered by.
const WORKFLOW_SORTS: SortOption[] = [
  { value: 'popular', label: t('workshop.sort.popular', locale) },
  { value: 'newest', label: t('workshop.hub.sort.newest', locale) },
  { value: 'name', label: t('workshop.sort.name', locale) }
]
const MODEL_SORTS: SortOption[] = [
  { value: 'popular', label: t('workshop.sort.popular', locale) },
  { value: 'name', label: t('workshop.sort.name', locale) },
  { value: 'priceAsc', label: t('workshop.sort.priceAsc', locale) },
  { value: 'priceDesc', label: t('workshop.sort.priceDesc', locale) }
]
const sortOptions = computed(() =>
  withModels && store.activeTab.value === 'models'
    ? MODEL_SORTS
    : WORKFLOW_SORTS
)

// An order the new tab cannot honour would otherwise linger in the button.
watch(sortOptions, (options) => {
  if (!options.some((option) => option.value === store.sortBy.value))
    store.setSort('popular')
})

const facetsConfig: FacetGroupConfig[] = [
  {
    key: 'media',
    type: 'media',
    label: t('workshop.filter.outputGroup', locale),
    display: 'segmented',
    allLabel: t('workshop.hub.kind.all', locale)
  },
  {
    key: 'categories',
    type: 'tag',
    label: t('workshop.filter.capabilityGroup', locale),
    display: 'chips',
    allLabel: t('workshop.hub.facets.allTasks', locale)
  },
  {
    key: 'models',
    type: 'model',
    label: t('workshop.hub.models', locale),
    display: 'select',
    allLabel: t('workshop.hub.facets.allModels', locale)
  },
  {
    key: 'partners',
    type: 'partner',
    label: t('workshop.hub.facets.partner', locale),
    display: 'select',
    allLabel: t('workshop.hub.facets.allPartners', locale)
  }
]
const gridLabels: GridLabels = {
  tryNow: t('workshop.hub.tryNow', locale),
  loadMore: t('workshop.hub.loadMore', locale),
  empty: t('workshop.hub.empty', locale),
  emptyHint: t('workshop.hub.emptyHint', locale),
  showing: t('workshop.hub.showing', locale)
}

// A card lands on the thing it names. A workflow that runs on a catalogue
// model says so on its own page, and offers the way across from there.
const hrefFor = (template: HubTemplate) => templatePath(template.name)

const filteredModels = computed(() => {
  const query = store.searchQuery.value.trim().toLowerCase()
  const matches = scoped.value.models.filter(
    (model) =>
      query === '' ||
      model.name.toLowerCase().includes(query) ||
      (model.provider ?? '').toLowerCase().includes(query)
  )
  const order = store.sortBy.value
  return sortWorkshopModels(matches, order === 'newest' ? 'popular' : order)
})

// Models open the All tab, in the same grid as the workflows behind them.
const LEAD_MODELS = 5

const modelFamilies = computed(() => groupModels(filteredModels.value))

const filteredTemplates = computed(() => {
  const badges = store.filterBadges.value
  const chosen = (type: FilterBadgeType) =>
    badges.filter((b) => b.type === type).map((b) => b.value)
  const tags = chosen('tag')
  const models = chosen('model')
  const media = chosen('media')
  const partners = chosen('partner')
  const query = store.searchQuery.value.trim().toLowerCase()
  return scoped.value.templates.filter(
    (tmpl) =>
      (tags.length === 0 || tags.some((tag) => tmpl.tags.includes(tag))) &&
      (models.length === 0 ||
        models.some((model) => tmpl.models.includes(model))) &&
      (media.length === 0 || media.includes(tmpl.mediaType)) &&
      (partners.length === 0 ||
        (tmpl.partner !== undefined && partners.includes(tmpl.partner))) &&
      (query === '' ||
        tmpl.title.toLowerCase().includes(query) ||
        tmpl.models.some((m) => m.toLowerCase().includes(query)) ||
        tmpl.tags.some((tag) =>
          tagDisplayName(tag).toLowerCase().includes(query)
        ) ||
        tmpl.username.toLowerCase().includes(query))
  )
})
</script>

<template>
  <section :class="cn(!embedded && 'pb-32')" data-testid="workshop-hub">
    <WorkshopHero
      v-if="!embedded"
      :heading-key="withModels ? 'workshop.hub.title' : 'templates.hero.title'"
      :subtitle-key="withModels ? undefined : 'templates.hero.subtitle'"
      :locale
      data-testid="hub-heading"
    />

    <div
      :class="
        cn('gap-10', railBeside && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]')
      "
    >
      <aside
        v-if="railBeside"
        class="mb-8 max-sm:mb-4 lg:sticky lg:top-28 lg:mb-0 lg:max-h-[calc(100vh-9rem)] lg:scrollbar-thin lg:self-start lg:overflow-y-auto lg:pt-4"
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
        <WorkflowGrid
          :templates="filteredTemplates"
          :facet-templates="templates"
          :facets-config="facetsConfig"
          :toolbar-labels="toolbarLabels"
          :sort-options="sortOptions"
          :labels="gridLabels"
          :href-for="hrefFor"
          :extra-filters="providers.length + capabilities.length"
          :model-count="modelFamilies.length"
          :with-models="withModels"
          @clear-extra="clearSearchFilters"
        >
          <template #search>
            <WorkshopSearchField
              v-model="store.searchQuery.value"
              v-model:providers="providers"
              v-model:capabilities="capabilities"
              :models
              :locale
              compact
              class="max-sm:size-10 max-sm:flex-none sm:w-64 lg:w-80"
            />
          </template>

          <template v-if="withModels && store.activeTab.value === 'all'" #lead>
            <WorkshopModelCard
              v-for="family in modelFamilies.slice(0, LEAD_MODELS)"
              :key="family.key"
              :model="family.latest"
              :locale
              provider-badge
              data-testid="hub-models-lead"
            />
          </template>

          <template v-if="withModels" #models>
            <ul
              class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="hub-models"
            >
              <li v-for="family in modelFamilies" :key="family.key">
                <WorkshopModelCard
                  :model="family.latest"
                  :locale
                  provider-badge
                />
              </li>
            </ul>
          </template>
        </WorkflowGrid>
      </div>
    </div>
  </section>
</template>
