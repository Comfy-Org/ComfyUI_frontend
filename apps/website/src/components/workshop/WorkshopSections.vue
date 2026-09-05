<script setup lang="ts">
import { ChevronRight, Sparkles } from '@lucide/vue'
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
import { groupByFamily } from '../../config/model-family'
import CardRow from './CardRow.vue'
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

// Router does not report a curated set yet, so the row that opens the listing
// is the catalogue's own most-run models. It reads as an editor's shelf and
// costs nothing to keep true as the catalogue grows.
const FEATURED_LIMIT = 6
const featured = computed(() =>
  groupByFamily(sortWorkshopModels(models, 'popular')).slice(0, FEATURED_LIMIT)
)

// Text, 3D and audio hold a handful of models each, so a row apiece reads as an
// empty shelf. They share one row until the catalogue fills out.
const GROUPED: readonly UseCase[] = ['text', '3d', 'audio']

const sections = computed(() =>
  USE_CASES.filter((useCase) => !GROUPED.includes(useCase))
    .map((useCase) => {
      const matches = groupByFamily(
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
  groupByFamily(
    GROUPED.flatMap((useCase) =>
      sortWorkshopModels(filterWorkshopModels(models, { useCase }), sort)
    )
  )
)

// A model the taxonomy cannot place would otherwise be reachable only by
// search, so it gets its own row rather than disappearing from the listing.
const unplaced = computed(() =>
  groupByFamily(
    sortWorkshopModels(
      models.filter((model) => useCaseFor(model) === undefined),
      sort
    )
  )
)
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <section
      v-if="featured.length"
      aria-labelledby="section-featured"
      class="rounded-4.5xl border border-transparency-white-t8 bg-linear-to-br from-primary-comfy-plum/35 via-transparency-white-t4 to-transparent p-6 lg:p-8"
      data-testid="section-featured"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            id="section-featured"
            class="flex items-center gap-2 text-xl font-medium text-primary-warm-white"
          >
            <Sparkles
              class="text-primary-comfy-yellow size-5"
              aria-hidden="true"
            />
            {{ t('workshop.sections.featured', locale) }}
          </h2>
        </template>

        <li
          v-for="family in featured"
          :key="family.key"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard
            :model="family.latest"
            :version-count="family.versions.length"
            :locale
            :show-status="showStatuses"
          />
        </li>
      </CardRow>
    </section>

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
            class="flex items-baseline gap-2 text-xl font-medium text-primary-warm-white"
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
            class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none focus-visible:ring-3"
            :data-testid="`section-${section.useCase}-see-all`"
            @click="emit('open', section.useCase)"
          >
            {{ t('workshop.sections.seeAll', locale) }}
            <ChevronRight class="size-4" aria-hidden="true" />
          </button>
        </template>

        <li
          v-for="family in section.shown"
          :key="family.key"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard
            :model="family.latest"
            :version-count="family.versions.length"
            :locale
            :show-status="showStatuses"
          />
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
            class="flex items-baseline gap-2 text-xl font-medium text-primary-warm-white"
          >
            {{ t('workshop.sections.otherFormats', locale) }}
            <span class="text-sm text-primary-warm-gray tabular-nums">
              {{ otherFormats.length }}
            </span>
          </h2>
        </template>

        <li
          v-for="family in otherFormats"
          :key="family.key"
          class="w-72 shrink-0 snap-start"
        >
          <WorkshopModelCard
            :model="family.latest"
            :version-count="family.versions.length"
            :locale
            :show-status="showStatuses"
          />
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
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5"
      >
        <li v-for="family in unplaced" :key="family.key">
          <WorkshopModelCard
            :model="family.latest"
            :version-count="family.versions.length"
            :locale
            :show-status="showStatuses"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
