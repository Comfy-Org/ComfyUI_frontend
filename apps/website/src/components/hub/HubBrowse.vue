<script setup lang="ts">
import { Search } from '@lucide/vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useHubStore } from '../../composables/useHubStore'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { UseCase } from '../../config/workshop'
import { USE_CASES, useCaseFor, workshopModels } from '../../config/workshop'
import { groupModels } from '../../config/model-family'
import hubTemplates from '../../data/hubTemplates.json'
import { hubWorkflowPath } from '../../lib/hub/workflow-detail'
import {
  partnerModelFor,
  useCaseForTemplate
} from '../../lib/hub/template-use-case'
import { tagDisplayName } from '../../lib/hub/tag-aliases'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetGroupConfig, ToolbarLabels } from './BrowseToolbar.vue'
import type { GridLabels } from './WorkflowGrid.vue'
import WorkflowGrid from './WorkflowGrid.vue'
import WorkshopHero from '../workshop/WorkshopHero.vue'
import WorkshopModelCard from '../workshop/WorkshopModelCard.vue'

const { locale = 'en', embedded = false } = defineProps<{
  locale?: Locale
  embedded?: boolean
}>()

const templates = hubTemplates as HubTemplate[]
const store = useHubStore()
const { groupVersions } = usePrototypeTweaks()
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

const inUseCase = (value: UseCase | 'all') => ({
  models: workshopModels.filter(
    (model) => value === 'all' || useCaseFor(model) === value
  ),
  templates: templates.filter(
    (tmpl) =>
      value === 'all' || useCaseForTemplate(tmpl, workshopModels) === value
  )
})

const totalIn = (value: UseCase | 'all') => {
  const { models, templates: scoped } = inUseCase(value)
  return groupModels(models, groupVersions.value).length + scoped.length
}

// In the catalogue's reading order, and without printing the tally: the row
// names use cases, it is not a report.
const useCaseTabs = computed(() => [
  { value: 'all' as const },
  ...USE_CASES.filter((value) => totalIn(value) > 0).map((value) => ({ value }))
])

const scoped = computed(() => inUseCase(useCase.value))

// The row is for narrowing what the use case already picked, so search stays
// out of the way until it is asked for.
const searchInput = ref<HTMLInputElement>()
const searching = ref(false)
async function openSearch() {
  searching.value = true
  await nextTick()
  searchInput.value?.focus()
}
function closeSearchIfEmpty() {
  if (store.searchQuery.value.trim() === '') searching.value = false
}

onMounted(() => {
  const params = new URLSearchParams(location.search)
  const tab = TABS.find((value) => value === params.get('tab'))
  if (tab) store.setTab(tab)
  const wanted = USE_CASES.find((value) => value === params.get('useCase'))
  if (wanted) useCase.value = wanted
  for (const type of ['tag', 'model'] as const) {
    const value = params.get(type)
    if (value) store.toggleBadge({ type, value })
  }
  const query = params.get('q')
  if (query) {
    store.searchQuery.value = query
    searching.value = true
  }
})

const toolbarLabels: ToolbarLabels = {
  all: t('workshop.hub.kind.all', locale),
  nodeGraphs: t('workshop.hub.kind.graph', locale),
  comfyApps: t('workshop.hub.kind.app', locale),
  models: t('workshop.hub.kind.models', locale),
  filter: t('workshop.filter.label', locale),
  clearAll: t('workshop.hub.facets.clearAll', locale),
  applied: t('workshop.filter.applied', locale),
  searchPlaceholder: t('workshop.hub.facets.search', locale),
  noResults: t('workshop.hub.facets.noResults', locale),
  more: t('workshop.hub.facets.more', locale),
  less: t('workshop.hub.facets.less', locale),
  sortPopular: t('workshop.hub.sort.popular', locale),
  sortNewest: t('workshop.hub.sort.newest', locale),
  showResults: t('workshop.hub.facets.show', locale)
}
const facetsConfig: FacetGroupConfig[] = [
  { key: 'models', type: 'model', label: t('workshop.hub.models', locale) },
  {
    key: 'categories',
    type: 'tag',
    label: t('workshop.hub.categories', locale)
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
  const tags = badges.filter((b) => b.type === 'tag').map((b) => b.value)
  const models = badges.filter((b) => b.type === 'model').map((b) => b.value)
  const query = store.searchQuery.value.trim().toLowerCase()
  return scoped.value.templates.filter(
    (tmpl) =>
      (tags.length === 0 || tags.some((tag) => tmpl.tags.includes(tag))) &&
      (models.length === 0 ||
        models.some((model) => tmpl.models.includes(model))) &&
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
    >
      <nav
        class="mt-12 flex scrollbar-thin gap-6 overflow-x-auto border-b border-white/10"
        :aria-label="t('workshop.media.label', locale)"
        data-testid="hub-use-cases"
      >
        <button
          v-for="entry in useCaseTabs"
          :key="entry.value"
          type="button"
          :aria-pressed="useCase === entry.value"
          :data-testid="`hub-use-case-${entry.value}`"
          :class="
            cn(
              'flex shrink-0 cursor-pointer items-baseline gap-1.5 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
              useCase === entry.value
                ? 'border-primary-warm-white text-primary-warm-white'
                : 'text-content-secondary hover:text-content border-transparent'
            )
          "
          @click="useCase = entry.value"
        >
          {{ t(useCaseLabelKey[entry.value], locale) }}
        </button>
      </nav>
    </WorkshopHero>

    <WorkflowGrid
      :templates="filteredTemplates"
      :facet-templates="templates"
      :facets-config="facetsConfig"
      :toolbar-labels="toolbarLabels"
      :labels="gridLabels"
      :href-for="hrefFor"
    >
      <template #search>
        <button
          v-if="!searching"
          type="button"
          :aria-label="t('workshop.hub.search', locale)"
          :title="t('workshop.hub.search', locale)"
          class="text-content-secondary hover:text-content focus-visible:ring-brand grid size-10 cursor-pointer place-items-center rounded-xl bg-white/8 transition-colors outline-none hover:bg-white/12 focus-visible:ring-2 xl:hidden"
          data-testid="hub-search-open"
          @click="openSearch"
        >
          <Search class="size-4" aria-hidden="true" />
        </button>
        <label
          :class="
            cn(
              'relative block w-96 max-w-full',
              !searching && 'hidden xl:block'
            )
          "
        >
          <span class="sr-only">{{ t('workshop.hub.search', locale) }}</span>
          <Search
            class="text-content-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            ref="searchInput"
            v-model="store.searchQuery.value"
            type="search"
            data-testid="hub-search"
            :placeholder="t('workshop.hub.search', locale)"
            class="text-content placeholder:text-content-muted focus-visible:ring-brand h-10 w-full rounded-xl bg-white/8 pr-3 pl-10 text-xs outline-none focus-visible:ring-2"
            @blur="closeSearchIfEmpty"
          />
        </label>
      </template>

      <template v-if="store.activeTab.value === 'all'" #lead>
        <WorkshopModelCard
          v-for="family in modelFamilies.slice(0, LEAD_MODELS)"
          :key="family.key"
          :model="family.latest"
          :version-count="family.versions.length"
          :locale
          data-testid="hub-models-lead"
        />
      </template>

      <template #models>
        <ul
          class="grid grid-cols-1 gap-5 min-[2200px]:grid-cols-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          data-testid="hub-models"
        >
          <li v-for="family in modelFamilies" :key="family.key">
            <WorkshopModelCard
              :model="family.latest"
              :version-count="family.versions.length"
              :locale
            />
          </li>
        </ul>
      </template>
    </WorkflowGrid>
  </section>
</template>
