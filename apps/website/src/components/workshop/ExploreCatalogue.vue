<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
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
import type { HomeUseCaseGroup } from '@/lib/workshop/home-use-case-groups'
import { homeUseCaseGroups } from '@/lib/workshop/home-use-case-groups'
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
const group = ref<HomeUseCaseGroup | 'all'>('all')

const everything = computed(() =>
  sortWorkshopModels([...workflows, ...models], 'popular')
)
const groups = computed(() =>
  homeUseCaseGroups(
    USE_CASES.filter((value) =>
      everything.value.some((model) => useCasesFor(model).includes(value))
    )
  )
)
const picked = computed(() =>
  groups.value.find((entry) => entry.group === group.value)
)
const art = computed(() => doorArt({ models, workflows, apps }, locale))

const needle = computed(() => query.value.trim().toLowerCase())
const filtered = computed(
  () => needle.value !== '' || picked.value !== undefined
)
const shownApps = computed(() =>
  picked.value === undefined
    ? apps.filter((app) =>
        `${app.name} ${app.task}`.toLowerCase().includes(needle.value)
      )
    : []
)
const results = computed(() =>
  filterWorkshopModels(everything.value, {
    query: query.value,
    useCases: picked.value?.useCases
  }).slice(0, RESULTS - shownApps.value.length)
)

const resultsTitle = computed(() => {
  if (needle.value)
    return t('workshop.explore.resultsFor', {
      query: query.value.trim()
    })
  if (picked.value) {
    const label = t(picked.value.label)
    return t('workshop.explore.popularFor', {
      useCase: label.charAt(0).toLocaleLowerCase(locale) + label.slice(1)
    })
  }
  return t('workshop.explore.popularTitle')
})
const seeAllHref = computed(() =>
  filtered.value
    ? routes.workshop +
      catalogSearch({
        query: query.value.trim(),
        useCase: picked.value?.useCases[0]
      })
    : undefined
)

function clear() {
  query.value = ''
  group.value = 'all'
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
      v-if="filtered || shownApps.length || results.length"
      :title="resultsTitle"
      :apps="shownApps"
      :results
      :see-all-href="seeAllHref"
      :locale
      @clear="clear"
    >
      <ExploreTaskChips
        v-if="!needle && groups.length"
        v-model="group"
        :groups
        :locale
      />
    </ExploreResults>

    <ExploreCommunity v-if="!needle" :locale />
  </div>
</template>
