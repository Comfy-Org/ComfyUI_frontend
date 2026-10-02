<script setup lang="ts">
import { computed, ref } from 'vue'

import type {
  UseCase,
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import {
  USE_CASES,
  catalogSearch,
  filterWorkshopModels,
  sortWorkshopModels,
  useCasesFor
} from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import { TASK_CARD } from '../../lib/workshop/card-layout'
import CardRow from './CardRow.vue'
import ExploreDoors from './ExploreDoors.vue'
import ExploreFinder from './ExploreFinder.vue'
import ExploreResults from './ExploreResults.vue'
import ExploreTaskTile from './ExploreTaskTile.vue'

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

const routes = getRoutes(locale)
const query = ref('')
const useCase = ref<UseCase | 'all'>('all')

const everything = computed(() =>
  sortWorkshopModels([...workflows, ...models], 'popular')
)
const tasks = computed(() =>
  USE_CASES.flatMap((value) => {
    const items = everything.value.filter((model) =>
      useCasesFor(model).includes(value)
    )
    return items.length ? [{ useCase: value, items }] : []
  })
)

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
    return t('workshop.explore.resultsFor', locale, {
      query: query.value.trim()
    })
  if (useCase.value !== 'all') return t(useCaseLabelKey[useCase.value], locale)
  return t('workshop.explore.popularTitle', locale)
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
    <ExploreFinder
      v-model:query="query"
      v-model:use-case="useCase"
      :use-cases="tasks.map((task) => task.useCase)"
      :locale
    />

    <section
      v-if="!filtered && tasks.length"
      aria-labelledby="explore-tasks"
      data-testid="explore-tasks"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            id="explore-tasks"
            class="text-xl font-medium text-primary-warm-white"
          >
            {{ t('workshop.explore.tasksTitle', locale) }}
          </h2>
        </template>
        <li v-for="task in tasks" :key="task.useCase" :class="TASK_CARD">
          <ExploreTaskTile
            :use-case="task.useCase"
            :items="task.items"
            :locale
            @select="useCase = task.useCase"
          />
        </li>
      </CardRow>
    </section>

    <ExploreResults
      v-if="filtered || shownApps.length || results.length"
      :title="resultsTitle"
      :apps="shownApps"
      :results
      :see-all-href="seeAllHref"
      :locale
      @clear="clear"
    />

    <ExploreDoors
      :apps="apps.length > 0"
      :workflows="workflows.length > 0"
      :locale
    />
  </div>
</template>
