<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import ExploreKindTag from './ExploreKindTag.vue'
import ExploreSeeAll from './ExploreSeeAll.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const {
  title,
  apps,
  results,
  seeAllHref,
  locale = 'en'
} = defineProps<{
  title: string
  apps: readonly CatalogueApp[]
  results: readonly WorkshopModel[]
  seeAllHref?: string
  locale?: Locale
}>()

defineEmits<{ clear: [] }>()
</script>

<template>
  <section aria-labelledby="explore-results" data-testid="explore-results">
    <div class="mb-5 flex items-end justify-between gap-4">
      <h2
        id="explore-results"
        class="text-xl font-medium text-primary-warm-white"
      >
        {{ title }}
      </h2>
      <ExploreSeeAll
        v-if="seeAllHref && results.length"
        :href="seeAllHref"
        :label="t('workshop.explore.modelsSeeAll', locale)"
      />
    </div>
    <ul
      v-if="apps.length || results.length"
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <li v-for="app in apps" :key="app.key" class="relative">
        <WorkshopAppCard :app />
        <ExploreKindTag kind="app" :locale />
      </li>
      <li v-for="model in results" :key="model.slug" class="relative">
        <WorkshopModelCard :model :locale />
        <ExploreKindTag
          :kind="model.workflowId ? 'workflow' : 'model'"
          :locale
        />
      </li>
    </ul>
    <div
      v-else
      class="flex flex-col items-start gap-3 rounded-3xl bg-hub-surface p-8"
      data-testid="explore-empty"
    >
      <p class="text-base text-content-secondary">
        {{ t('workshop.explore.empty', locale) }}
      </p>
      <button
        type="button"
        class="cursor-pointer rounded-lg text-sm font-medium text-primary-comfy-yellow outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        @click="$emit('clear')"
      >
        {{ t('workshop.explore.clear', locale) }}
      </button>
    </div>
  </section>
</template>
