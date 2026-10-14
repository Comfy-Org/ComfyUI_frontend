<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  AppWorkshopModel,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { catalogSearch, sortWorkshopModels } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import { doorArt } from '@/lib/workshop/explore-art'
import type { ExploreCount, ExploreEntry } from '@/lib/workshop/explore-search'
import { exploreRow, searchExplore } from '@/lib/workshop/explore-search'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import ExploreDoors from './ExploreDoors.vue'
import ExploreFinder from './ExploreFinder.vue'
import ExploreResults from './ExploreResults.vue'

const RESULTS = 12

const {
  models,
  appsShown,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  appsShown: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)

const query = ref('')
const needle = computed(() => query.value.trim())

const shown = computed(() => models.filter(isWorkshopModelShown))
const routerModels = computed(() =>
  shown.value.filter((model) => model.routerId !== undefined)
)
const workflows = computed(() =>
  shown.value.filter(
    (model): model is WorkflowWorkshopModel =>
      model.type === 'CLOUD' || model.type === 'SERVERLESS'
  )
)
const apps = computed<readonly CatalogueApp[]>(() =>
  appsShown
    ? shown.value
        .filter((model): model is AppWorkshopModel => model.type === 'APP')
        .map((app) => ({
          key: app.slug,
          name: app.name,
          task: ac(
            app.appId === 'studio' ? 'studioTask' : 'reshootTask',
            locale
          ),
          href: app.href,
          thumbnail: app.thumbnail
        }))
    : []
)

const art = computed(() =>
  doorArt(
    {
      models: routerModels.value,
      workflows: workflows.value,
      apps: apps.value
    },
    locale
  )
)
const counts = computed(() => ({
  models: routerModels.value.length,
  workflows: workflows.value.length,
  apps: apps.value.length
}))

const matches = computed(() =>
  searchExplore(
    {
      apps: apps.value,
      workflows: workflows.value,
      models: routerModels.value
    },
    needle.value
  )
)

const popular = computed<ExploreEntry[]>(() => [
  ...apps.value.map((app) => ({ kind: 'app' as const, app })),
  ...sortWorkshopModels([...workflows.value, ...routerModels.value], 'popular')
    .slice(0, RESULTS - apps.value.length)
    .map((model) => ({
      kind: model.workflowId ? ('workflow' as const) : ('model' as const),
      model
    }))
])

const entries = computed(() =>
  needle.value ? exploreRow(matches.value, RESULTS) : popular.value
)

const kindCounts = computed<ExploreCount[]>(() => {
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
  <div class="mt-2 flex flex-col gap-14" data-testid="explore-home">
    <ExploreFinder v-model="query" :locale />

    <ExploreDoors v-if="!needle" :counts :art :locale />

    <ExploreResults
      v-if="needle || entries.length"
      :title="resultsTitle"
      :entries
      :counts="kindCounts"
      :locale
      @clear="clear"
    />
  </div>
</template>
