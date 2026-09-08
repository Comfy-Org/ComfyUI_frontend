<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FilterBadgeType } from '../../composables/useHubStore'
import { useHubStore } from '../../composables/useHubStore'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { UseCase, WorkshopModel } from '../../config/workshop'
import { USE_CASES, useCaseFor, workshopModels } from '../../config/workshop'
import { groupModels } from '../../config/model-family'
import hubTemplates from '../../data/hubTemplates.json'
import { hubWorkflowPath } from '../../lib/hub/workflow-detail'
import {
  partnerModelFor,
  useCaseForTemplate
} from '../../lib/hub/template-use-case'
import { tagDisplayName } from '../../lib/hub/tag-aliases'
import { withFacetFields } from '../../lib/hub/facet-fields'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetGroupConfig, ToolbarLabels } from './BrowseToolbar.vue'
import HubUseCaseNav from './HubUseCaseNav.vue'
import type { GridLabels } from './WorkflowGrid.vue'
import WorkflowGrid from './WorkflowGrid.vue'
import WorkshopHero from '../workshop/WorkshopHero.vue'
import WorkshopModelCard from '../workshop/WorkshopModelCard.vue'
import WorkshopSearchField from '../workshop/WorkshopSearchField.vue'

const { locale = 'en', embedded = false } = defineProps<{
  locale?: Locale
  embedded?: boolean
}>()

const templates = (hubTemplates as HubTemplate[]).map((template) =>
  withFacetFields(template, workshopModels)
)
const store = useHubStore()
const { groupVersions } = usePrototypeTweaks()

// The use cases read as a rail beside the grid, the way the models listing
// does. Embedded elsewhere the hub is a grid on its own, without them.
const railBeside = computed(() => !embedded)
onUnmounted(() => store.reset())

const TABS = ['all', 'nodeGraphs', 'comfyApps', 'models'] as const

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
      workshopModels
        .filter(matchesModel)
        .map((model) => model.name.toLowerCase())
    )
)

const runsMatchingModel = (tmpl: HubTemplate) =>
  !narrowed.value ||
  tmpl.models.some((name) => matchingModelNames.value.has(name.toLowerCase()))

const inUseCase = (value: UseCase | 'all') => ({
  models: workshopModels.filter(
    (model) =>
      (value === 'all' || useCaseFor(model) === value) && matchesModel(model)
  ),
  templates: templates.filter(
    (tmpl) =>
      (value === 'all' || useCaseForTemplate(tmpl, workshopModels) === value) &&
      runsMatchingModel(tmpl)
  )
})

const totalIn = (value: UseCase | 'all') => {
  const { models, templates: scoped } = inUseCase(value)
  return groupModels(models, groupVersions.value).length + scoped.length
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
  for (const type of ['tag', 'model'] as const) {
    const value = params.get(type)
    if (value) store.toggleBadge({ type, value })
  }
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
  sortPopular: t('workshop.hub.sort.popular', locale),
  sortNewest: t('workshop.hub.sort.newest', locale),
  showResults: t('workshop.hub.facets.show', locale)
}
const facetsConfig: FacetGroupConfig[] = [
  {
    key: 'media',
    type: 'media',
    label: t('workshop.hub.facets.media', locale),
    display: 'segmented',
    allLabel: t('workshop.hub.kind.all', locale)
  },
  {
    key: 'categories',
    type: 'tag',
    label: t('workshop.hub.facets.task', locale),
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
  },
  {
    key: 'industries',
    type: 'industry',
    label: t('workshop.hub.facets.industry', locale),
    display: 'chips',
    allLabel: t('workshop.hub.facets.allIndustries', locale),
    limit: 8
  }
]
const gridLabels: GridLabels = {
  tryNow: t('workshop.hub.tryNow', locale),
  loadMore: t('workshop.hub.loadMore', locale),
  empty: t('workshop.hub.empty', locale),
  emptyHint: t('workshop.hub.emptyHint', locale),
  showing: t('workshop.hub.showing', locale)
}

// A Hub entry tagged as a partner node whose model matches a Workshop model
// opens that model's playground; everything else stays on comfy.org.
const hrefFor = (template: HubTemplate) =>
  partnerModelFor(template, workshopModels)?.href ??
  hubWorkflowPath(template.name)

const filteredModels = computed(() => {
  const query = store.searchQuery.value.trim().toLowerCase()
  const matches = scoped.value.models.filter(
    (model) =>
      query === '' ||
      model.name.toLowerCase().includes(query) ||
      (model.provider ?? '').toLowerCase().includes(query)
  )
  return store.sortBy.value === 'popular'
    ? [...matches].sort((a, b) => b.runs - a.runs)
    : [...matches].sort((a, b) => a.name.localeCompare(b.name))
})

// Models open the All tab, in the same grid as the workflows behind them.
const LEAD_MODELS = 5

const modelFamilies = computed(() =>
  groupModels(filteredModels.value, groupVersions.value)
)

const filteredTemplates = computed(() => {
  const badges = store.filterBadges.value
  const chosen = (type: FilterBadgeType) =>
    badges.filter((b) => b.type === type).map((b) => b.value)
  const tags = chosen('tag')
  const models = chosen('model')
  const media = chosen('media')
  const partners = chosen('partner')
  const industries = chosen('industry')
  const query = store.searchQuery.value.trim().toLowerCase()
  return scoped.value.templates.filter(
    (tmpl) =>
      (tags.length === 0 || tags.some((tag) => tmpl.tags.includes(tag))) &&
      (models.length === 0 ||
        models.some((model) => tmpl.models.includes(model))) &&
      (media.length === 0 || media.includes(tmpl.mediaType)) &&
      (partners.length === 0 ||
        (tmpl.partner !== undefined && partners.includes(tmpl.partner))) &&
      (industries.length === 0 ||
        industries.some((industry) =>
          (tmpl.industries as readonly string[]).includes(industry)
        )) &&
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
      heading-key="workshop.hub.title"
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
        <div v-if="providers.length" class="mb-6 flex flex-wrap gap-2">
          <button
            v-for="name in providers"
            :key="name"
            type="button"
            class="text-page bg-brand hover:bg-brand/90 inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
            data-testid="hub-provider-chip"
            @click="providers = providers.filter((entry) => entry !== name)"
          >
            {{ name }}
            <X class="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <WorkflowGrid
          :templates="filteredTemplates"
          :facet-templates="templates"
          :facets-config="facetsConfig"
          :toolbar-labels="toolbarLabels"
          :labels="gridLabels"
          :href-for="hrefFor"
        >
          <template #search>
            <WorkshopSearchField
              v-model="store.searchQuery.value"
              v-model:providers="providers"
              v-model:capabilities="capabilities"
              :models="workshopModels"
              :locale
              compact
              class="max-sm:size-10 max-sm:flex-none sm:w-64 lg:w-80"
            />
          </template>

          <template v-if="store.activeTab.value === 'all'" #lead>
            <WorkshopModelCard
              v-for="family in modelFamilies.slice(0, LEAD_MODELS)"
              :key="family.key"
              :model="family.latest"
              :version-count="family.versions.length"
              :locale
              provider-badge
              data-testid="hub-models-lead"
            />
          </template>

          <template #models>
            <ul
              class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              data-testid="hub-models"
            >
              <li v-for="family in modelFamilies" :key="family.key">
                <WorkshopModelCard
                  :model="family.latest"
                  :version-count="family.versions.length"
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
