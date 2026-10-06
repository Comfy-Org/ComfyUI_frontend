<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  UseCase,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import {
  USE_CASES,
  catalogSearch,
  filterWorkshopModels,
  sortWorkshopModels,
  useCasesFor
} from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { doorArt } from '@/lib/workshop/explore-art'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import ExploreCommunity from './ExploreCommunity.vue'
import ExploreDoors from './ExploreDoors.vue'
import ExploreFinder from './ExploreFinder.vue'
import ExploreResults from './ExploreResults.vue'
import ExploreTaskChips from './ExploreTaskChips.vue'

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
const useCase = ref<UseCase | 'all'>('all')

const everything = computed(() =>
  sortWorkshopModels([...workflows, ...models], 'popular')
)
const useCases = computed(() =>
  USE_CASES.filter((value) =>
    everything.value.some((model) => useCasesFor(model).includes(value))
  )
)
const art = computed(() => doorArt({ models, workflows, apps }, locale))

const needle = computed(() => query.value.trim().toLowerCase())
const filtered = computed(() => needle.value !== '' || useCase.value !== 'all')
const shownApps = computed(() =>
  useCase.value === 'all'
    ? apps.filter((app) =>
        `${app.name} ${app.task}`.toLowerCase().includes(needle.value)
      )
    : []
)
const results = computed(() =>
  filterWorkshopModels(everything.value, {
    query: query.value,
    useCase: useCase.value
  }).slice(0, RESULTS - shownApps.value.length)
)

const resultsTitle = computed(() => {
  if (needle.value)
    return t('workshop.explore.resultsFor', {
      query: query.value.trim()
    })
  if (useCase.value !== 'all') {
    const label = t(useCaseLabelKey[useCase.value])
    return t('workshop.explore.popularFor', {
      useCase: label.charAt(0).toLocaleLowerCase(locale) + label.slice(1)
    })
  }
  return t('workshop.explore.popularTitle')
})
const seeAllHref = computed(() =>
  filtered.value
    ? routes.workshop +
      catalogSearch({ query: query.value.trim(), useCase: useCase.value })
    : undefined
)

function clear() {
  query.value = ''
  useCase.value = 'all'
}
</script>

<template>
  <div class="mt-2 flex flex-col gap-14" data-testid="explore-catalogue">
    <ExploreFinder v-model="query" :locale />

    <ExploreDoors
      :counts="{
        apps: apps.length,
        workflows: workflows.length,
        models: models.length
      }"
      :art
      :locale
    />

    <ExploreResults
      v-if="filtered || shownApps.length || results.length"
      :title="resultsTitle"
      :description="needle ? undefined : t('workshop.explore.popularBody')"
      :apps="shownApps"
      :results
      :see-all-href="seeAllHref"
      :locale
      @clear="clear"
    >
      <ExploreTaskChips
        v-if="useCases.length"
        v-model="useCase"
        :use-cases="useCases"
        :locale
      />
    </ExploreResults>

    <ExploreCommunity :locale />
  </div>
</template>
