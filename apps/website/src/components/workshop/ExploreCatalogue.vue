<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '../../config/models-catalogue'
import { sortWorkshopModels } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { SHELF_CARD } from '../../lib/workshop/card-layout'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import CardRow from './CardRow.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const TEASER_SIZE = 4

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
const popular = (list: readonly WorkshopModel[]) =>
  sortWorkshopModels(list, 'popular').slice(0, TEASER_SIZE)

const sections = computed(() => [
  {
    id: 'create',
    title: t('workshop.space.create', locale),
    hint: t('workshop.space.createHint', locale),
    href: routes.hubApps,
    apps: apps.slice(0, TEASER_SIZE),
    models: []
  },
  {
    id: 'customize',
    title: t('workshop.space.customize', locale),
    hint: t('workshop.space.customizeHint', locale),
    href: routes.hubWorkflows,
    apps: [],
    models: popular(workflows)
  },
  {
    id: 'build',
    title: t('workshop.space.build', locale),
    hint: t('workshop.space.buildHint', locale),
    href: routes.workshop,
    apps: [],
    models: popular(models)
  }
])
const shown = computed(() =>
  sections.value.filter(
    (section) => section.apps.length || section.models.length
  )
)
</script>

<template>
  <div class="mt-4 flex flex-col gap-12" data-testid="explore-catalogue">
    <section
      v-for="section in shown"
      :key="section.id"
      :aria-labelledby="`explore-${section.id}`"
      :data-testid="`explore-${section.id}`"
    >
      <CardRow :locale>
        <template #heading>
          <div class="flex flex-col gap-1">
            <h2
              :id="`explore-${section.id}`"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ section.title }}
            </h2>
            <p class="text-sm text-content-secondary">{{ section.hint }}</p>
          </div>
        </template>
        <template #actions>
          <a
            :href="section.href"
            class="group inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          >
            {{ t('workshop.explore.seeAll', locale) }}
            <span class="sr-only">{{ section.title }}</span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </template>
        <li v-for="app in section.apps" :key="app.key" :class="SHELF_CARD">
          <WorkshopAppCard :app />
        </li>
        <li
          v-for="model in section.models"
          :key="model.slug"
          :class="SHELF_CARD"
        >
          <WorkshopModelCard :model :locale />
        </li>
      </CardRow>
    </section>
  </div>
</template>
