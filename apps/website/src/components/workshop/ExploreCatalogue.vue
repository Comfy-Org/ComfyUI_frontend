<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { catalogSearch, sortWorkshopModels } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { upcomingApps } from '@/lib/workshop/coming-soon-apps'
import { doorArt } from '@/lib/workshop/explore-art'
import type { ExploreCount, ExploreEntry } from '@/lib/workshop/explore-search'
import { exploreRow, searchExplore } from '@/lib/workshop/explore-search'
import ExploreCommunity from './ExploreCommunity.vue'
import ExploreDoors from './ExploreDoors.vue'
import ExploreFinder from './ExploreFinder.vue'
import ExploreResults from './ExploreResults.vue'

const RESULTS = 12

const {
  apps,
  workflows,
  models,
  locale = 'en'
} = defineProps<{
  apps: readonly CatalogueApp[]
  workflows: readonly WorkflowWorkshopModel[]
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
const query = ref('')

const art = computed(() => doorArt({ models, workflows, apps }, locale))

const needle = computed(() => query.value.trim())
// An app still being built is found by name, but not offered as popular.
const searchedApps = computed(() =>
  apps.length ? [...apps, ...upcomingApps(locale)] : []
)
const matches = computed(() =>
  searchExplore({ apps: searchedApps.value, workflows, models }, needle.value)
)

const popular = computed<ExploreEntry[]>(() => [
  ...apps.map((app) => ({ kind: 'app' as const, app })),
  ...sortWorkshopModels([...workflows, ...models], 'popular')
    .slice(0, RESULTS - apps.length)
    .map((model) => ({
      kind: model.workflowId ? ('workflow' as const) : ('model' as const),
      model
    }))
])

const entries = computed(() =>
  needle.value ? exploreRow(matches.value, RESULTS) : popular.value
)

const counts = computed<ExploreCount[]>(() => {
  if (!needle.value) return []
  const search = catalogSearch({ query: needle.value })
  return [
    {
      kind: 'models' as const,
      count: matches.value.models.length,
      href: routes.workshop + search
    },
    {
      kind: 'workflows' as const,
      count: matches.value.workflows.length,
      href: routes.hubWorkflows + search
    },
    {
      kind: 'apps' as const,
      count: matches.value.apps.length,
      href: routes.hubApps
    }
  ].filter((entry) => entry.count > 0)
})

const resultsTitle = computed(() =>
  needle.value
    ? t('workshop.explore.resultsFor', { query: needle.value })
    : t('workshop.explore.popularTitle')
)

function clear() {
  query.value = ''
}
</script>

<template>
  <div class="mt-2 flex flex-col gap-14" data-testid="explore-catalogue">
    <ExploreFinder v-model="query" :locale />

    <ExploreDoors
      v-if="!needle"
      :counts="{
        apps: apps.length,
        workflows: workflows.length,
        models: models.length
      }"
      :art
      :locale
    />

    <ExploreResults
      v-if="needle || entries.length"
      :title="resultsTitle"
      :entries
      :counts
      :locale
      @clear="clear"
    />

    <ExploreCommunity v-if="!needle" :locale />
  </div>
</template>
