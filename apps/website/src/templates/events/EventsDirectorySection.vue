<script setup lang="ts">
import { CalendarDays, ChevronDown, LayoutGrid, Map, Search } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { MapPinMarker } from '../../components/blocks/MapPins01.vue'
import type { Locale } from '../../i18n/translations'
import type { EventsDirectoryView } from '../../utils/eventsDirectory'

import MapPins01 from '../../components/blocks/MapPins01.vue'
import EventsAgendaView from './EventsAgendaView.vue'
import EventsCardsView from './EventsCardsView.vue'
import { directoryEvents, eventsDerivedAt } from '../../data/events'
import { t } from '../../i18n/translations'
import {
  DIRECTORY_FILTER_ALL,
  EVENT_CATEGORIES,
  EVENT_ORGANIZERS,
  defaultDirectoryFilters,
  directoryRows,
  filterDirectoryEvents
} from '../../utils/eventsDirectory'
import EventsDirectoryList from './EventsDirectoryList.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Search, type and organizer feed whichever view is active, so the whole
// section is one reactive model: three filter fields plus the view. Everything
// else, the visible events and the live count, is derived.
const filters = reactive(defaultDirectoryFilters())
const view = ref<EventsDirectoryView>('map')
const sort = ref<'latest' | 'oldest'>('latest')

const visibleEvents = computed(() =>
  filterDirectoryEvents(directoryEvents, filters, locale)
)

// `directoryEvents` is latest-first, so Oldest is a plain reversal of the
// filtered slice rather than a second date sort. The agenda view re-groups
// rows by month with its own chronology either way.
const sortedEvents = computed(() =>
  sort.value === 'latest'
    ? visibleEvents.value
    : [...visibleEvents.value].reverse()
)

// Derived once and handed to whichever view is showing, so the list and the
// cards can never disagree about a CTA or a date. Classification reuses the
// clock that ordered `directoryEvents`, so a row's position and its CTA can
// never straddle the upcoming/past boundary.
const rows = computed(() =>
  directoryRows(sortedEvents.value, locale, eventsDerivedAt)
)

// Pins are the filtered events that have coordinates; virtual events stay in
// the list and never reach the map. The block takes a generic markers prop, so
// the events -> markers mapping lives here rather than inside it.
const markers = computed<MapPinMarker[]>(() =>
  rows.value.flatMap((row) =>
    row.event.coords
      ? [{ id: row.event.id, coords: row.event.coords, label: row.title }]
      : []
  )
)

// A pin click selects its event; the list scrolls to that row and highlights
// it. Filtering the event away clears the selection for good — restoring the
// filter must not resurrect a pin click the visitor made under different
// filters. The computed mask covers the tick before the watcher runs.
const pinnedId = ref<string | null>(null)
watch(visibleEvents, (events) => {
  if (pinnedId.value && !events.some((event) => event.id === pinnedId.value)) {
    pinnedId.value = null
  }
})
const selectedEventId = computed(() =>
  visibleEvents.value.some((event) => event.id === pinnedId.value)
    ? pinnedId.value
    : null
)

// Names a cluster badge for screen readers: the count plus what a click does.
const clusterLabel = (labels: string[]) =>
  t('events.directory.clusterLabel', locale).replace(
    '{count}',
    String(labels.length)
  )

// `t()` has neither interpolation nor plurals, so both are resolved here.
const countLabel = computed(() => {
  const count = visibleEvents.value.length
  const key =
    count === 1 ? 'events.directory.countOne' : 'events.directory.count'
  return t(key, locale).replace('{count}', String(count))
})

// Switching tabs leaves `filters` untouched, so search and both filters carry
// across views; only the presentation changes.
const VIEWS: ReadonlyArray<{
  key: EventsDirectoryView
  icon: typeof Map
}> = [
  { key: 'map', icon: Map },
  { key: 'cards', icon: LayoutGrid },
  { key: 'calendar', icon: CalendarDays }
]

const controlClass =
  'bg-transparency-white-t5 h-11 rounded-full border border-white/15 text-sm text-primary-comfy-canvas'

// `appearance-none` drops the native arrow, so each select is wrapped and gets
// a ChevronDown overlaid, the same icon the rest of the site uses.
const selectClass = cn(
  controlClass,
  'w-full cursor-pointer appearance-none pr-10 pl-4 sm:w-auto'
)

const caretClass =
  'pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-primary-comfy-canvas/50'
</script>

<template>
  <section
    id="events-directory"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-16 lg:px-20 lg:py-24"
  >
    <div class="mx-auto max-w-3xl text-center">
      <p
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
        aria-live="polite"
      >
        {{ countLabel }}
      </p>

      <h2
        class="mt-4 text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ t('events.directory.title', locale) }}
      </h2>

      <p
        class="mt-6 text-base font-light text-balance text-primary-comfy-canvas lg:text-lg"
      >
        {{ t('events.directory.lead', locale) }}
      </p>
    </div>

    <div
      class="mt-10 flex flex-col gap-3 lg:mt-12 lg:flex-row lg:items-center"
      data-testid="events-directory-controls"
    >
      <label for="events-directory-search" class="sr-only">
        {{ t('events.directory.searchLabel', locale) }}
      </label>
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-comfy-canvas/50"
          aria-hidden="true"
        />
        <input
          id="events-directory-search"
          v-model="filters.query"
          type="search"
          :placeholder="t('events.directory.searchPlaceholder', locale)"
          :class="
            cn(
              controlClass,
              'w-full pr-4 pl-11 placeholder:text-primary-comfy-canvas/50'
            )
          "
        />
      </div>

      <label for="events-directory-type" class="sr-only">
        {{ t('events.directory.typeLabel', locale) }}
      </label>
      <div class="relative">
        <select
          id="events-directory-type"
          v-model="filters.category"
          :class="selectClass"
        >
          <option :value="DIRECTORY_FILTER_ALL">
            {{ t('events.directory.allTypes', locale) }}
          </option>
          <option
            v-for="category in EVENT_CATEGORIES"
            :key="category"
            :value="category"
          >
            {{ t(`events.category.${category}`, locale) }}
          </option>
        </select>
        <ChevronDown :class="caretClass" aria-hidden="true" />
      </div>

      <label for="events-directory-organizer" class="sr-only">
        {{ t('events.directory.organizerLabel', locale) }}
      </label>
      <div class="relative">
        <select
          id="events-directory-organizer"
          v-model="filters.organizer"
          :class="selectClass"
        >
          <option :value="DIRECTORY_FILTER_ALL">
            {{ t('events.directory.allOrganizers', locale) }}
          </option>
          <option
            v-for="organizer in EVENT_ORGANIZERS"
            :key="organizer"
            :value="organizer"
          >
            {{ t(`events.organizer.${organizer}`, locale) }}
          </option>
        </select>
        <ChevronDown :class="caretClass" aria-hidden="true" />
      </div>

      <template v-if="view !== 'calendar'">
        <label for="events-directory-sort" class="sr-only">
          {{ t('events.directory.sortLabel', locale) }}
        </label>
        <div class="relative">
          <select
            id="events-directory-sort"
            v-model="sort"
            :class="selectClass"
          >
            <option value="latest">
              {{ t('events.directory.sortLatest', locale) }}
            </option>
            <option value="oldest">
              {{ t('events.directory.sortOldest', locale) }}
            </option>
          </select>
          <ChevronDown :class="caretClass" aria-hidden="true" />
        </div>
      </template>

      <div
        role="group"
        :aria-label="t('events.directory.viewLabel', locale)"
        class="flex gap-1 rounded-2xl border border-white/15 p-1.5"
      >
        <button
          v-for="entry in VIEWS"
          :key="entry.key"
          type="button"
          :aria-pressed="view === entry.key"
          :class="
            cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-colors',
              view === entry.key
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'text-primary-comfy-canvas hover:bg-white/10'
            )
          "
          @click="view = entry.key"
        >
          <component :is="entry.icon" class="size-3.5" aria-hidden="true" />
          {{ t(`events.directory.view.${entry.key}`, locale) }}
        </button>
      </div>
    </div>

    <div
      v-if="view === 'map'"
      class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[54fr_46fr]"
    >
      <MapPins01
        :markers
        :region-label="t('events.directory.mapLabel', locale)"
        :cluster-label="clusterLabel"
        class="h-80 sm:h-96 lg:h-140"
        @select="pinnedId = $event"
      />

      <EventsDirectoryList :rows :locale :selected-event-id="selectedEventId" />
    </div>

    <div v-else-if="view === 'cards'" class="mt-6">
      <EventsCardsView :rows :locale />
    </div>

    <div v-else class="mt-6">
      <EventsAgendaView :rows :locale />
    </div>
  </section>
</template>
