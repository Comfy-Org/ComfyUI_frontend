<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type {
  SortOrder,
  UseCase,
  WorkshopModel
} from '../../config/models-catalogue'
import {
  USE_CASES,
  filterWorkshopModels,
  sortWorkshopModels,
  useCasesFor
} from '../../config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '../../config/workshop-sections'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { groupModels } from '../../config/model-family'
import { rememberShelfOnClick } from '../../lib/workshop/shelf-memory'
import CardRow from './CardRow.vue'
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

const GROUPED = OTHER_FORMAT_USE_CASES

const titleClass =
  'hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 cursor-pointer rounded-lg text-xl font-medium text-primary-warm-white transition-colors outline-none focus-visible:ring-3'

// The count belongs to the screen the link opens, not to the row, which loads
// eight whatever the total says.
const seeAllClass =
  'group hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none focus-visible:ring-3'

const cardClass =
  'w-60 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] md:w-[calc((100cqw-3*1.25rem)/3.5)] lg:w-[calc((100cqw-4*1.25rem)/4.5)] xl:w-[calc((100cqw-5*1.25rem)/5.5)]'

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
    sortWorkshopModels(filterWorkshopModels(models, { useCase: 'other' }), sort)
  )
)

// A model the taxonomy cannot place would otherwise be reachable only by
// search, so it gets its own row rather than disappearing from the listing.
const unplaced = computed(() =>
  groupModels(
    sortWorkshopModels(
      models.filter((model) => useCasesFor(model).length === 0),
      sort
    )
  )
)

function rememberModel(
  shelf: UseCase | 'all' | 'other',
  model: WorkshopModel,
  event: MouseEvent
) {
  rememberShelfOnClick(event, shelf, model.href)
}
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="workshop-sections">
    <section
      v-for="section in sections"
      :key="section.useCase"
      :aria-labelledby="`section-${section.useCase}`"
      :data-testid="`section-${section.useCase}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2 :id="`section-${section.useCase}`">
            <button
              type="button"
              :class="titleClass"
              :data-testid="`section-${section.useCase}-open`"
              @click="emit('open', section.useCase)"
            >
              {{ t(labelKey[section.useCase], locale) }}
            </button>
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            :class="seeAllClass"
            :data-testid="`section-${section.useCase}-see-all`"
            @click="emit('open', section.useCase)"
          >
            <span class="tabular-nums">
              {{
                t('workshop.sections.seeAll', locale).replace(
                  '{n}',
                  `${section.total}`
                )
              }}
            </span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="family in section.shown"
          :key="family.key"
          :class="cardClass"
        >
          <WorkshopModelCard
            :model="family.latest"
            :locale
            @click="rememberModel(section.useCase, family.latest, $event)"
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
          <h2 id="section-other-formats">
            <button
              type="button"
              :class="titleClass"
              data-testid="section-other-formats-open"
              @click="emit('open', 'other')"
            >
              {{ t('workshop.sections.otherFormats', locale) }}
            </button>
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            :class="seeAllClass"
            data-testid="section-other-formats-see-all"
            @click="emit('open', 'other')"
          >
            <span class="tabular-nums">
              {{
                t('workshop.sections.seeAll', locale).replace(
                  '{n}',
                  `${otherFormats.length}`
                )
              }}
            </span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="family in otherFormats.slice(0, ROW_LIMIT)"
          :key="family.key"
          :class="cardClass"
        >
          <WorkshopModelCard
            :model="family.latest"
            :locale
            @click="rememberModel('other', family.latest, $event)"
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
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <li v-for="family in unplaced" :key="family.key">
          <WorkshopModelCard
            :model="family.latest"
            :locale
            @click="rememberModel('all', family.latest, $event)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
