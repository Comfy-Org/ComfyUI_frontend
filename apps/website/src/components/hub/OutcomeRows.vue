<script setup lang="ts">
import { computed } from 'vue'

import type { WorkshopOutcome } from '../../config/workshop-outcomes'
import { WORKSHOP_OUTCOMES } from '../../config/workshop-outcomes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/hub'
import type { BrowseEntry } from '../../lib/hub/browse-entry'
import { sortBrowseEntries } from '../../lib/hub/browse-entry'
import CardRow from '../workshop/CardRow.vue'
import CatalogueCard from './CatalogueCard.vue'

// A row is a way in, not the listing: it opens with enough to be worth
// scrolling and stops short of repeating the grid underneath it.
const ROW_LIMIT = 10
const MIN_ENTRIES = 2

const { entries, locale = 'en' } = defineProps<{
  entries: readonly BrowseEntry[]
  locale?: Locale
}>()

const emit = defineEmits<{ open: [outcome: WorkshopOutcome] }>()

/**
 * The job names what someone came to do, and the entries have already been
 * narrowed to one medium, so a row turns up wherever its tags have members and
 * stays out of the shelves where they have none. That is how one "Upscale and
 * restore" heads the images and the videos without being written twice.
 */
const rows = computed(() =>
  WORKSHOP_OUTCOMES.map((outcome) => {
    const wanted = new Set<string>(outcome.tags)
    const matches = sortBrowseEntries(
      entries.filter((entry) => entry.tags.some((tag) => wanted.has(tag))),
      'popular'
    )
    return {
      outcome,
      total: matches.length,
      shown: matches.slice(0, ROW_LIMIT)
    }
  }).filter((row) => row.total >= MIN_ENTRIES)
)

const cardClass = 'peek-card shrink-0 snap-start'
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
            v-if="row.total > row.shown.length"
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
