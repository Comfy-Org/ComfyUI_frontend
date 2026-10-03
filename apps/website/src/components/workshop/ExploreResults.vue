<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import { SHELF_CARD } from '../../lib/workshop/card-layout'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { nameWithoutTask, taskLabelFor } from '../../lib/workshop/task-label'
import CardRow from './CardRow.vue'
import ExploreKindTag from './ExploreKindTag.vue'
import ExploreSeeAll from './ExploreSeeAll.vue'
import ExploreResultCard from './ExploreResultCard.vue'

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
const { t } = translationsFor(locale)

defineEmits<{ clear: [] }>()
</script>

<template>
  <section aria-labelledby="explore-results" data-testid="explore-results">
    <CardRow v-if="apps.length || results.length" :locale>
      <template #heading>
        <h2
          id="explore-results"
          class="text-xl font-medium text-primary-warm-white"
        >
          {{ title }}
        </h2>
      </template>
      <template #actions>
        <ExploreSeeAll
          v-if="seeAllHref && results.length"
          :href="seeAllHref"
          :label="t('workshop.explore.modelsSeeAll')"
        />
      </template>
      <li
        v-for="app in apps"
        :key="app.key"
        :class="cn(SHELF_CARD, 'relative')"
      >
        <ExploreResultCard
          :href="app.href"
          :name="app.name"
          :detail="app.task"
          :image="app.image"
        />
        <ExploreKindTag kind="app" :locale />
      </li>
      <li
        v-for="model in results"
        :key="model.slug"
        :class="cn(SHELF_CARD, 'relative')"
      >
        <ExploreResultCard
          :href="model.href"
          :name="nameWithoutTask(model.name, taskLabelFor(model, locale))"
          :detail="taskLabelFor(model, locale)"
          :model
        />
        <ExploreKindTag
          :kind="model.workflowId ? 'workflow' : 'model'"
          :locale
        />
      </li>
    </CardRow>
    <template v-else>
      <h2
        id="explore-results"
        class="mb-5 text-xl font-medium text-primary-warm-white"
      >
        {{ title }}
      </h2>
      <div
        class="flex flex-col items-start gap-3 rounded-3xl bg-hub-surface p-8"
        data-testid="explore-empty"
      >
        <p class="text-base text-content-secondary">
          {{ t('workshop.explore.empty') }}
        </p>
        <button
          type="button"
          class="cursor-pointer rounded-lg text-sm font-medium text-primary-comfy-yellow outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          @click="$emit('clear')"
        >
          {{ t('workshop.explore.clear') }}
        </button>
      </div>
    </template>
  </section>
</template>
