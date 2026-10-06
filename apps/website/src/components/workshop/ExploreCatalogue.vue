<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import {
  catalogSearch,
  filterWorkshopModels,
  sortWorkshopModels
} from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { doorArt } from '@/lib/workshop/explore-art'
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

const everything = computed(() =>
  sortWorkshopModels([...workflows, ...models], 'popular')
)
const art = computed(() => doorArt({ models, workflows, apps }, locale))

const needle = computed(() => query.value.trim().toLowerCase())
const shownApps = computed(() =>
  apps.filter((app) =>
    `${app.name} ${app.task}`.toLowerCase().includes(needle.value)
  )
)
const results = computed(() =>
  filterWorkshopModels(everything.value, { query: query.value }).slice(
    0,
    RESULTS - shownApps.value.length
  )
)

const resultsTitle = computed(() =>
  needle.value
    ? t('workshop.explore.resultsFor', { query: query.value.trim() })
    : t('workshop.explore.popularTitle')
)
const seeAllHref = computed(() =>
  needle.value
    ? routes.workshop + catalogSearch({ query: query.value.trim() })
    : undefined
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
      v-if="needle || shownApps.length || results.length"
      :title="resultsTitle"
      :apps="shownApps"
      :results
      :see-all-href="seeAllHref"
      :locale
      @clear="clear"
    />

    <ExploreCommunity v-if="!needle" :locale />
  </div>
</template>
