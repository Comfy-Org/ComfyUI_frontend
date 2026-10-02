<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

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
import ComingSoonApps from './ComingSoonApps.vue'
import ExploreSeeAll from './ExploreSeeAll.vue'
import UseCaseCard from './UseCaseCard.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const USE_CASES = 4
const ROW = 8
const PROVIDER_CHIPS = 5

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
const useCases = computed(() =>
  sortWorkshopModels(workflows, 'popular').slice(0, USE_CASES)
)
const popularModels = computed(() => sortWorkshopModels(models, 'popular'))
const providers = computed(() =>
  [
    ...new Set(
      popularModels.value.flatMap((model) =>
        model.provider ? [model.provider] : []
      )
    )
  ].slice(0, PROVIDER_CHIPS)
)
const provider = ref<string>()
const shownModels = computed(() =>
  popularModels.value
    .filter((model) => !provider.value || model.provider === provider.value)
    .slice(0, ROW)
)

const chipClass = (active: boolean) =>
  cn(
    'h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
    active
      ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
      : 'border-transparency-white-t8 text-content-secondary hover:text-content-bright'
  )
</script>

<template>
  <div class="mt-4 flex flex-col gap-14" data-testid="explore-catalogue">
    <section
      v-if="useCases.length"
      aria-labelledby="explore-use-cases"
      data-testid="explore-use-cases"
    >
      <div class="mb-5 flex items-end justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2
            id="explore-use-cases"
            class="text-xl font-medium text-primary-warm-white"
          >
            {{ t('workshop.explore.useCasesTitle', locale) }}
          </h2>
          <p class="text-sm text-content-secondary">
            {{ t('workshop.explore.useCasesHint', locale) }}
          </p>
        </div>
        <ExploreSeeAll
          :href="routes.hubWorkflows"
          :label="t('workshop.explore.useCasesSeeAll', locale)"
        />
      </div>
      <ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <li v-for="workflow in useCases" :key="workflow.slug">
          <UseCaseCard :workflow :locale />
        </li>
      </ul>
    </section>

    <section
      v-if="apps.length"
      aria-labelledby="explore-apps"
      data-testid="explore-apps"
    >
      <CardRow :locale>
        <template #heading>
          <div class="flex flex-col gap-1">
            <h2
              id="explore-apps"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ t('workshop.explore.appsTitle', locale) }}
            </h2>
            <p class="text-sm text-content-secondary">
              {{ t('workshop.explore.appsHint', locale) }}
            </p>
          </div>
        </template>
        <template #actions>
          <ExploreSeeAll
            :href="routes.hubApps"
            :label="t('workshop.explore.appsSeeAll', locale)"
          />
        </template>
        <li v-for="app in apps" :key="app.key" :class="SHELF_CARD">
          <WorkshopAppCard :app />
        </li>
      </CardRow>
      <ComingSoonApps
        :label="t('workshop.explore.comingSoon', locale)"
        data-testid="explore-coming-soon"
      />
    </section>

    <section
      v-if="popularModels.length"
      aria-labelledby="explore-models"
      data-testid="explore-models"
    >
      <CardRow :locale>
        <template #heading>
          <div class="flex flex-col gap-1">
            <h2
              id="explore-models"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ t('workshop.explore.modelsTitle', locale) }}
            </h2>
            <p class="text-sm text-content-secondary">
              {{ t('workshop.explore.modelsHint', locale) }}
            </p>
            <div
              class="mt-3 flex flex-wrap gap-2"
              role="group"
              :aria-label="t('workshop.explore.providers', locale)"
            >
              <button
                type="button"
                :class="chipClass(!provider)"
                :aria-pressed="!provider"
                @click="provider = undefined"
              >
                {{ t('workshop.explore.allProviders', locale) }}
              </button>
              <button
                v-for="name in providers"
                :key="name"
                type="button"
                :class="chipClass(provider === name)"
                :aria-pressed="provider === name"
                @click="provider = name"
              >
                {{ name }}
              </button>
            </div>
          </div>
        </template>
        <template #actions>
          <ExploreSeeAll
            :href="routes.workshop"
            :label="t('workshop.explore.modelsSeeAll', locale)"
          />
        </template>
        <li v-for="model in shownModels" :key="model.slug" :class="SHELF_CARD">
          <WorkshopModelCard :model :locale />
        </li>
      </CardRow>
    </section>
  </div>
</template>
