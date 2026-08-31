<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import { t } from '../../i18n/translations'
import EventsDirectoryRow from './EventsDirectoryRow.vue'

const {
  rows,
  locale = 'en',
  selectedEventId = null
} = defineProps<{
  rows: readonly DirectoryRow[]
  locale?: Locale
  /** The event whose map pin was clicked; its row highlights and scrolls in. */
  selectedEventId?: string | null
}>()

const listElement = useTemplateRef<HTMLElement>('listElement')

// Bringing the selected row into view is a one-way sync with the DOM: nothing
// reads back from it. `nextTick` covers the case where the selection arrives in
// the same tick as a filter change that re-renders the rows.
watch(
  () => selectedEventId,
  async (id) => {
    if (!id) return
    await nextTick()
    listElement.value
      ?.querySelector(`[data-event-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
)
</script>

<template>
  <div
    class="flex h-140 flex-col overflow-hidden rounded-3xl border border-white/10"
  >
    <p
      class="shrink-0 border-b border-white/10 px-6 py-4 text-xs font-semibold tracking-widest text-primary-comfy-canvas uppercase"
    >
      {{ t('events.directory.allEvents', locale) }}
    </p>

    <p
      v-if="rows.length === 0"
      class="px-6 py-8 text-sm text-primary-comfy-canvas/70"
    >
      {{ t('events.directory.empty', locale) }}
    </p>

    <ul
      v-else
      ref="listElement"
      class="divide-y divide-white/8 overflow-y-auto"
      :aria-label="t('events.directory.allEvents', locale)"
    >
      <EventsDirectoryRow
        v-for="row in rows"
        :key="row.event.id"
        :row
        :locale
        :selected="row.event.id === selectedEventId"
      />
    </ul>
  </div>
</template>
