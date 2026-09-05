<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import { t } from '../../i18n/translations'
import { groupRowsByMonth, monthLabel } from '../../utils/eventsDirectory'
import EventsDirectoryRow from './EventsDirectoryRow.vue'

const { rows, locale = 'en' } = defineProps<{
  rows: readonly DirectoryRow[]
  locale?: Locale
}>()

// This view has no Figma design (blueprint open question 2): agenda grouped by
// month with sticky headers was decided at blueprint time, drawn in the list
// view's language. Flagged for a designer pass in ticket 08.
const months = computed(() => groupRowsByMonth(rows))
</script>

<template>
  <div
    class="max-h-160 overflow-y-auto rounded-3xl border border-white/10"
    data-testid="events-directory-agenda"
  >
    <p
      v-if="months.length === 0"
      class="px-6 py-8 text-sm text-primary-comfy-canvas/70"
    >
      {{ t('events.directory.empty', locale) }}
    </p>

    <template v-else>
      <section v-for="month in months" :key="month.key">
        <!-- Sticky within this scroll container, so the month you are reading
        stays named as you move through it. -->
        <h3
          class="bg-site-dropdown text-primary-comfy-yellow sticky top-0 z-10 border-y border-white/10 px-6 py-3 text-xs font-semibold tracking-widest uppercase backdrop-blur-sm first:border-t-0"
          :data-month="month.key"
        >
          {{ monthLabel(month.key, locale) }}
        </h3>

        <ul
          class="divide-y divide-white/8"
          :aria-label="monthLabel(month.key, locale)"
        >
          <EventsDirectoryRow
            v-for="row in month.rows"
            :key="row.event.id"
            :row
            :locale
          />
        </ul>
      </section>
    </template>
  </div>
</template>
