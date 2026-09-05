<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useHubStore } from '../../composables/useHubStore'
import { badgesAvailableIn, templatesInTab } from '../../lib/hub/hub-tabs'
import type { HubTemplate } from '../../lib/hub/types'
import type { FacetGroupConfig, ToolbarLabels } from './BrowseToolbar.vue'
import BrowseToolbar from './BrowseToolbar.vue'
import HubWorkflowCard from './HubWorkflowCard.vue'

export interface GridLabels {
  readonly tryNow: string
  readonly loadMore: string
  readonly empty: string
  readonly emptyHint: string
  readonly showing: string
}

const {
  templates,
  facetTemplates,
  facetsConfig,
  toolbarLabels,
  labels,
  hrefFor
} = defineProps<{
  templates: readonly HubTemplate[]
  facetTemplates: readonly HubTemplate[]
  facetsConfig: readonly FacetGroupConfig[]
  toolbarLabels: ToolbarLabels
  labels: GridLabels
  hrefFor: (template: HubTemplate) => string
}>()

const PAGE = 30
const store = useHubStore()
const displayCount = ref(PAGE)

// Counts ignore the badge selection so they stay stable while filtering, but
// honour the tab so no count advertises more than its tab can return.
const facetSource = computed(() =>
  templatesInTab(facetTemplates, store.activeTab.value)
)

watch([() => templates, store.activeTab, store.sortBy], () => {
  displayCount.value = PAGE
})

watch(store.activeTab, () => {
  const badges = store.filterBadges.value
  const kept = badgesAvailableIn(badges, facetSource.value)
  if (kept.length !== badges.length) store.filterBadges.value = kept
})

const byDate = (a: HubTemplate, b: HubTemplate) => {
  if (!a.date && !b.date) return 0
  if (!a.date) return 1
  if (!b.date) return -1
  return new Date(b.date).getTime() - new Date(a.date).getTime()
}

const sortedTemplates = computed(() =>
  templatesInTab(templates, store.activeTab.value).sort(
    store.sortBy.value === 'popular' ? (a, b) => b.usage - a.usage : byDate
  )
)
const displayedTemplates = computed(() =>
  sortedTemplates.value.slice(0, displayCount.value)
)
const hasMore = computed(
  () => displayCount.value < sortedTemplates.value.length
)
const showingText = computed(() =>
  labels.showing
    .replace('{shown}', String(displayedTemplates.value.length))
    .replace('{total}', String(sortedTemplates.value.length))
)
</script>

<template>
  <div class="w-full min-w-0 flex-1">
    <div class="bg-page sticky top-20 z-30 mb-6 py-4 lg:top-26">
      <BrowseToolbar
        :templates="facetSource"
        :facets-config="facetsConfig"
        :labels="toolbarLabels"
        :result-count="sortedTemplates.length"
      >
        <template #search><slot name="search" /></template>
      </BrowseToolbar>
    </div>

    <slot v-if="store.activeTab.value === 'models'" name="models" />
    <div
      v-else
      class="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      data-testid="hub-grid"
    >
      <slot name="lead" />
      <HubWorkflowCard
        v-for="tmpl in displayedTemplates"
        :key="tmpl.name"
        :template="tmpl"
        :href="hrefFor(tmpl)"
        :try-now-label="labels.tryNow"
      />
    </div>

    <div
      v-if="
        store.activeTab.value !== 'models' && displayedTemplates.length === 0
      "
      class="text-content-muted py-20 text-center"
      data-testid="hub-empty"
    >
      <p class="text-lg">{{ labels.empty }}</p>
      <p class="mt-2 text-sm">{{ labels.emptyHint }}</p>
    </div>

    <div v-if="hasMore" class="flex justify-center pt-10 pb-4">
      <button
        type="button"
        data-testid="hub-load-more"
        class="border-brand text-brand hover:bg-brand hover:text-page inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border px-12 text-sm font-semibold tracking-wider uppercase transition-colors"
        @click="displayCount += PAGE"
      >
        <span class="ppformula-text-center-sm">{{ labels.loadMore }}</span>
      </button>
    </div>

    <div
      v-if="store.activeTab.value !== 'models'"
      class="text-hub-muted pt-2 pb-4 text-center text-sm"
      data-testid="hub-showing"
    >
      {{ showingText }}
    </div>
  </div>
</template>
