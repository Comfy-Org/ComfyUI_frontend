<script setup lang="ts">
import { Search } from '@lucide/vue'
import { computed, onUnmounted } from 'vue'

import { useHubStore } from '../../composables/useHubStore'
import type { WorkshopModel } from '../../config/workshop'
import { workshopModels } from '../../config/workshop'
import hubTemplates from '../../data/hubTemplates.json'
import { hubWorkflowUrl } from '../../lib/hub/routes'
import { tagDisplayName } from '../../lib/hub/tag-aliases'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetGroupConfig, ToolbarLabels } from './BrowseToolbar.vue'
import type { GridLabels } from './WorkflowGrid.vue'
import WorkflowGrid from './WorkflowGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const templates = hubTemplates as HubTemplate[]
const store = useHubStore()
onUnmounted(() => store.reset())

const toolbarLabels: ToolbarLabels = {
  all: t('workshop.hub.kind.all', locale),
  nodeGraphs: t('workshop.hub.kind.graph', locale),
  comfyApps: t('workshop.hub.kind.app', locale),
  filter: t('workshop.filter.label', locale),
  clearAll: t('workshop.hub.facets.clearAll', locale),
  searchPlaceholder: t('workshop.hub.facets.search', locale),
  noResults: t('workshop.hub.facets.noResults', locale),
  sortPopular: t('workshop.hub.sort.popular', locale),
  sortNewest: t('workshop.hub.sort.newest', locale)
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

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

// A Hub entry tagged as a partner node whose model matches a Workshop model
// opens that model's playground; everything else stays on comfy.org.
function partnerModelFor(template: HubTemplate): WorkshopModel | undefined {
  if (!template.tags.includes('API')) return undefined
  const names = template.models.map(normalize)
  return (
    workshopModels.find((model) => names.includes(normalize(model.name))) ??
    workshopModels.find((model) => {
      const key = normalize(model.name)
      return (
        key.length >= 4 &&
        names.some((name) => name.includes(key) || key.includes(name))
      )
    })
  )
}

const hrefFor = (template: HubTemplate) =>
  partnerModelFor(template)?.href ?? hubWorkflowUrl(template.name)

const filteredTemplates = computed(() => {
  const badges = store.filterBadges.value
  const tags = badges.filter((b) => b.type === 'tag').map((b) => b.value)
  const models = badges.filter((b) => b.type === 'model').map((b) => b.value)
  const query = store.searchQuery.value.trim().toLowerCase()
  return templates.filter(
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
  <section class="pb-32" data-testid="workshop-hub">
    <div class="bg-page sticky top-0 z-40 pt-2 pb-6 lg:pb-8">
      <label class="relative block">
        <span class="sr-only">{{ t('workshop.hub.search', locale) }}</span>
        <Search
          class="text-content-muted pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          v-model="store.searchQuery.value"
          type="search"
          data-testid="hub-search"
          :placeholder="t('workshop.hub.search', locale)"
          class="bg-hub-surface text-content placeholder:text-content-muted focus-visible:ring-brand h-12 w-full rounded-full border border-white/10 pr-14 pl-12 text-sm outline-none focus-visible:ring-2"
        />
        <kbd
          class="text-content-muted pointer-events-none absolute top-1/2 right-4 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-white/15 font-sans text-2xs"
          aria-hidden="true"
        >
          /
        </kbd>
      </label>
    </div>
    <WorkflowGrid
      :templates="filteredTemplates"
      :facet-templates="templates"
      :facets-config="facetsConfig"
      :toolbar-labels="toolbarLabels"
      :labels="gridLabels"
      :href-for="hrefFor"
    />
  </section>
</template>
