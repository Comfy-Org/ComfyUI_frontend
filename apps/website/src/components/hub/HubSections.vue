<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { BrowseEntry } from '../../lib/hub/browse-entry'
import { sortBrowseEntries } from '../../lib/hub/browse-entry'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'
import CardRow from '../workshop/CardRow.vue'
import { rememberShelfOnClick } from '../../lib/workshop/shelf-memory'
import CatalogueCard from './CatalogueCard.vue'

const ROW_LIMIT = 8

const { entries, locale = 'en' } = defineProps<{
  entries: readonly BrowseEntry[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [UseCase] }>()

const shelves = computed(() =>
  USE_CASES.map((useCase) => {
    const matches = sortBrowseEntries(
      entries.filter((entry) => entry.useCases.includes(useCase)),
      'popular'
    )
    return {
      useCase,
      total: matches.length,
      shown: matches.slice(0, ROW_LIMIT)
    }
  }).filter((shelf) => shelf.total > 0)
)

const titleClass =
  'cursor-pointer rounded-lg text-xl font-medium text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'

const seeAllClass =
  'group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'

const cardClass = 'peek-card shrink-0 snap-start'
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="hub-sections">
    <section
      v-for="shelf in shelves"
      :key="shelf.useCase"
      :aria-labelledby="`shelf-${shelf.useCase}`"
      :data-testid="`shelf-${shelf.useCase}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2 :id="`shelf-${shelf.useCase}`">
            <button
              type="button"
              :class="titleClass"
              :data-testid="`shelf-${shelf.useCase}-open`"
              @click="emit('open', shelf.useCase)"
            >
              {{ t(useCaseLabelKey[shelf.useCase], locale) }}
            </button>
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            :class="seeAllClass"
            :data-testid="`shelf-${shelf.useCase}-see-all`"
            @click="emit('open', shelf.useCase)"
          >
            <span class="tabular-nums">
              {{
                t('workshop.sections.seeAll', locale).replace(
                  '{n}',
                  `${shelf.total}`
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
          v-for="entry in shelf.shown"
          :key="entry.key"
          :class="cardClass"
          @click="rememberShelfOnClick($event, 'all', entry.card.href)"
        >
          <CatalogueCard :view="entry.card" :locale />
        </li>
      </CardRow>
    </section>
  </div>
</template>
