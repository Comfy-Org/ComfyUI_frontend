<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/models-catalogue'
import {
  USE_CASES,
  filterWorkshopModels,
  sortWorkshopModels,
  useCaseFor
} from '../../config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '../../config/workshop-sections'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { groupModels } from '../../config/model-family'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import CardRow from './CardRow.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const ROW_LIMIT = 8

const {
  models,
  labelKey,
  sort = 'popular',
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  labelKey: Record<UseCase | 'all', TranslationKey>
  sort?: SortOrder
  locale?: Locale
}>()

const emit = defineEmits<{ open: [UseCase | 'other'] }>()

const { showFeatured } = usePrototypeTweaks()

const GROUPED = OTHER_FORMAT_USE_CASES

// Router reports no curated set yet, so the banner that opens the listing
// carries the catalogue's own most-run models and costs nothing to keep true
// as the catalogue grows.
const FEATURED_LIMIT = 6
const featured = computed(() =>
  groupModels(sortWorkshopModels(models, 'popular'))
    .slice(0, FEATURED_LIMIT)
    .map((family) => family.latest)
)

const titleClass = 'flex items-baseline gap-2 text-primary-warm-white'

const seeAllClass =
  'group hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none focus-visible:ring-3'

const sections = computed(() =>
  USE_CASES.filter((useCase) => !GROUPED.includes(useCase))
    .map((useCase) => {
      const matches = groupModels(
        sortWorkshopModels(filterWorkshopModels(models, { useCase }), sort)
      )
      return {
        useCase,
        total: matches.length,
        shown: matches.slice(0, ROW_LIMIT)
      }
    })
    .filter((section) => section.total > 0)
)

const otherFormats = computed(() =>
  groupModels(
    GROUPED.flatMap((useCase) =>
      sortWorkshopModels(filterWorkshopModels(models, { useCase }), sort)
    )
  )
)

// A model the taxonomy cannot place would otherwise be reachable only by
// search, so it gets its own row rather than disappearing from the listing.
const unplaced = computed(() =>
  groupModels(
    sortWorkshopModels(
      models.filter((model) => useCaseFor(model) === undefined),
      sort
    )
  )
)
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <FeaturedBanner
      v-if="showFeatured && featured.length"
      :models="featured"
      :locale
    />

    <section
      v-for="section in sections"
      :key="section.useCase"
      :aria-labelledby="`section-${section.useCase}`"
      :data-testid="`section-${section.useCase}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            :id="`section-${section.useCase}`"
            :class="cn(titleClass, 'text-xl font-medium')"
          >
            {{ t(labelKey[section.useCase], locale) }}
            <span class="text-sm text-primary-warm-gray tabular-nums">
              {{ section.total }}
            </span>
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            :class="seeAllClass"
            :data-testid="`section-${section.useCase}-see-all`"
            @click="emit('open', section.useCase)"
          >
            {{ t('workshop.sections.seeAll', locale) }}
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="family in section.shown"
          :key="family.key"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard :model="family.latest" :locale />
        </li>
      </CardRow>
    </section>

    <section
      v-if="otherFormats.length"
      aria-labelledby="section-other-formats"
      data-testid="section-other-formats"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            id="section-other-formats"
            :class="cn(titleClass, 'text-xl font-medium')"
          >
            {{ t('workshop.sections.otherFormats', locale) }}
            <span class="text-sm text-primary-warm-gray tabular-nums">
              {{ otherFormats.length }}
            </span>
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            :class="seeAllClass"
            data-testid="section-other-formats-see-all"
            @click="emit('open', 'other')"
          >
            {{ t('workshop.sections.seeAll', locale) }}
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="family in otherFormats"
          :key="family.key"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard :model="family.latest" :locale />
        </li>
      </CardRow>
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
      <ul
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <li v-for="family in unplaced" :key="family.key">
          <WorkshopModelCard :model="family.latest" :locale />
        </li>
      </ul>
    </section>
  </div>
</template>
