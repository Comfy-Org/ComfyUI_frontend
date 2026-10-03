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
import { translationsFor } from '../../i18n/translations'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { DOOR_ART, TASK_ART } from '../../lib/workshop/explore-art'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import { TASK_CARD } from '../../lib/workshop/card-layout'
import CardRow from './CardRow.vue'
import ExploreCommunity from './ExploreCommunity.vue'
import ExploreDoors from './ExploreDoors.vue'
import ExploreFinder from './ExploreFinder.vue'
import ExploreResults from './ExploreResults.vue'
import ExploreTaskChips from './ExploreTaskChips.vue'
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
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
const query = ref('')
const useCase = ref<UseCase | 'all'>('all')

const everything = computed(() =>
  sortWorkshopModels([...workflows, ...models], 'popular')
)
const coverOf = (
  useCase: UseCase,
  items: readonly WorkshopModel[]
): WorkshopModel['thumbnail'] => {
  const art = TASK_ART[useCase]
  if (art) return { url: art, kind: 'image' }
  return (
    items.find((item) => item.thumbnail?.kind === 'image') ??
    items.find((item) => item.thumbnail)
  )?.thumbnail
}
const kindsOf = (items: readonly WorkshopModel[]) => [
  ...(items.some((item) => item.workflowId)
    ? [t('workshop.explore.workflowPill')]
    : []),
  ...(items.some((item) => item.routerId)
    ? [t('workshop.explore.kindModel')]
    : [])
]
const tasks = computed(() =>
  USE_CASES.flatMap((value) => {
    const items = everything.value.filter((model) =>
      useCasesFor(model).includes(value)
    )
    return items.length
      ? [
          {
            useCase: value,
            cover: coverOf(value, items),
            kinds: kindsOf(items)
          }
        ]
      : []
  })
)

const popular = computed(() => [
  ...apps.map((app) => app.image),
  ...everything.value
    .slice(0, RESULTS - apps.length)
    .map((model) => model.thumbnail?.url)
])
const doorArt = computed(() => {
  const shown = new Set([
    ...popular.value,
    ...tasks.value.map((task) => task.cover?.url)
  ])
  const pick = (list: readonly string[]) =>
    list.filter((url) => !shown.has(url)).slice(0, 3)
  return {
    apps: pick(DOOR_ART.apps),
    workflows: pick(DOOR_ART.workflows),
    models: pick(DOOR_ART.models)
  }
})

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
  if (useCase.value !== 'all') return t(useCaseLabelKey[useCase.value])
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
      :art="doorArt"
      :locale
    />

    <div class="flex flex-col gap-8">
      <section
        v-if="tasks.length"
        aria-labelledby="explore-tasks"
        class="flex flex-col gap-5"
      >
        <h2
          id="explore-tasks"
          class="text-xl font-medium text-primary-warm-white"
        >
          {{ t('workshop.explore.tasksTitle') }}
        </h2>
        <ExploreTaskChips
          v-model="useCase"
          :use-cases="tasks.map((task) => task.useCase)"
          :locale
        />
        <CardRow v-if="!filtered" :locale data-testid="explore-tasks">
          <li v-for="task in tasks" :key="task.useCase" :class="TASK_CARD">
            <ExploreTaskTile
              :use-case="task.useCase"
              :cover="task.cover"
              :kinds="task.kinds"
              :locale
              @select="useCase = task.useCase"
            />
          </li>
        </CardRow>
      </section>

      <ExploreResults
        v-if="filtered || shownApps.length || results.length"
        class="mt-6"
        :title="resultsTitle"
        :apps="shownApps"
        :results
        :see-all-href="seeAllHref"
        :locale
        @clear="clear"
      />
    </div>

    <ExploreCommunity :locale />
  </div>
</template>
