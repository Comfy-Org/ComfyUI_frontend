<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { SortOrder, UseCase, WorkshopModel } from '../../config/workshop'
import {
  USE_CASES,
  filterWorkshopModels,
  sortWorkshopModels,
  useCaseFor
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopModelCard from './WorkshopModelCard.vue'

const ROW_LIMIT = 8

const {
  models,
  labelKey,
  sort = 'popular',
  locale = 'en',
  showStatuses = false
} = defineProps<{
  models: readonly WorkshopModel[]
  labelKey: Record<UseCase | 'all', TranslationKey>
  sort?: SortOrder
  locale?: Locale
  showStatuses?: boolean
}>()

const emit = defineEmits<{ open: [UseCase] }>()

const sections = computed(() =>
  USE_CASES.map((useCase) => {
    const matches = sortWorkshopModels(
      filterWorkshopModels(models, { useCase }),
      sort
    )
    return {
      useCase,
      total: matches.length,
      shown: matches.slice(0, ROW_LIMIT)
    }
  }).filter((section) => section.total > 0)
)

// A model the taxonomy cannot place would otherwise be reachable only by
// search, so it gets its own row rather than disappearing from the listing.
const unplaced = computed(() =>
  sortWorkshopModels(
    models.filter((model) => useCaseFor(model) === undefined),
    sort
  )
)
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <section
      v-for="section in sections"
      :key="section.useCase"
      :aria-labelledby="`section-${section.useCase}`"
      :data-testid="`section-${section.useCase}`"
    >
      <div class="mb-5 flex items-center justify-between gap-4">
        <h2
          :id="`section-${section.useCase}`"
          class="flex items-baseline gap-2 text-xl font-medium text-primary-warm-white"
        >
          {{ t(labelKey[section.useCase], locale) }}
          <span class="text-sm text-primary-warm-gray tabular-nums">
            {{ section.total }}
          </span>
        </h2>
        <button
          type="button"
          class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none focus-visible:ring-3"
          :data-testid="`section-${section.useCase}-see-all`"
          @click="emit('open', section.useCase)"
        >
          {{ t('workshop.sections.seeAll', locale) }}
          <ChevronRight class="size-4" aria-hidden="true" />
        </button>
      </div>

      <ul
        class="-mx-1 flex snap-x scrollbar-thin gap-5 overflow-x-auto px-1 pb-2"
      >
        <li
          v-for="model in section.shown"
          :key="model.slug"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard :model :locale :show-status="showStatuses" />
        </li>
      </ul>
    </section>

    <section
      v-if="unplaced.length"
      aria-labelledby="section-other"
      data-testid="section-other"
    >
      <h2
        id="section-other"
        class="mb-5 flex items-baseline gap-2 text-xl font-medium text-primary-warm-white"
      >
        {{ t('workshop.filter.other', locale) }}
        <span class="text-sm text-primary-warm-gray tabular-nums">
          {{ unplaced.length }}
        </span>
      </h2>
      <ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="model in unplaced" :key="model.slug">
          <WorkshopModelCard :model :locale :show-status="showStatuses" />
        </li>
      </ul>
    </section>
  </div>
</template>
