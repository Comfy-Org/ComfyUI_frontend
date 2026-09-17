<script setup lang="ts">
import { computed } from 'vue'

import type { UseCase } from '../../config/models-catalogue'
import type { WorkshopOutcome } from '../../config/workshop-outcomes'
import { capabilitiesOf, outcomesIn } from '../../config/workshop-outcomes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { BrowseEntry } from '../../lib/hub/browse-entry'
import { sortBrowseEntries } from '../../lib/hub/browse-entry'
import CardRow from '../workshop/CardRow.vue'
import CatalogueCard from './CatalogueCard.vue'

// A row is a way in, not the listing: it opens with enough to be worth
// scrolling and stops short of repeating the grid underneath it.
const ROW_LIMIT = 10
const MIN_ENTRIES = 2

const {
  useCase,
  entries,
  locale = 'en'
} = defineProps<{
  useCase: UseCase
  entries: readonly BrowseEntry[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [outcome: WorkshopOutcome] }>()

/**
 * The medium is derived and always complete, so it filters. The job is curated
 * and names what someone came to do, so it heads a row. One list of tags scopes
 * both sides of that row: a workflow joins by the tags it carries and a model
 * by the capability those tags stand for, which is why a model that does
 * everything joins none of them.
 */
const rows = computed(() =>
  outcomesIn(useCase)
    .map((outcome) => {
      const wanted = new Set<string>([
        ...outcome.tags,
        ...capabilitiesOf(outcome)
      ])
      const matches = sortBrowseEntries(
        entries.filter((entry) => entry.tags.some((tag) => wanted.has(tag))),
        'popular'
      )
      return {
        outcome,
        total: matches.length,
        shown: matches.slice(0, ROW_LIMIT)
      }
    })
    .filter((row) => row.total >= MIN_ENTRIES)
)

const cardClass =
  'w-60 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] md:w-[calc((100cqw-3*1.25rem)/3.5)] lg:w-[calc((100cqw-4*1.25rem)/4.5)] xl:w-[calc((100cqw-5*1.25rem)/5.5)]'
</script>

<template>
  <div
    v-if="rows.length > 0"
    class="mb-14 flex flex-col gap-12"
    data-testid="outcome-rows"
  >
    <section
      v-for="row in rows"
      :key="row.outcome.key"
      :aria-labelledby="`outcome-${row.outcome.key}`"
      :data-testid="`outcome-${row.outcome.key}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2
            :id="`outcome-${row.outcome.key}`"
            class="text-xl font-medium text-primary-warm-white"
          >
            {{ t(row.outcome.labelKey, locale) }}
          </h2>
        </template>

        <template #actions>
          <button
            type="button"
            class="cursor-pointer rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
            :data-testid="`outcome-${row.outcome.key}-see-all`"
            @click="emit('open', row.outcome)"
          >
            <span class="tabular-nums">
              {{
                t('workshop.outcome.seeAll', locale).replace(
                  '{n}',
                  `${row.total}`
                )
              }}
            </span>
          </button>
        </template>

        <li v-for="entry in row.shown" :key="entry.key" :class="cardClass">
          <CatalogueCard :view="entry.card" :locale />
        </li>
      </CardRow>
    </section>
  </div>
</template>
