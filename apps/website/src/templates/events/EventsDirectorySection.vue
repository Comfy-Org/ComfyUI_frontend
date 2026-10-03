<script setup lang="ts">
import { CalendarDays, LayoutGrid, Map } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import type { MapPinMarker } from '../../components/blocks/MapPins01.vue'
import type { ComfyEvent } from '../../data/events'
import type { Locale } from '../../i18n/translations'
import type { EventsDirectoryView } from '../../utils/eventsDirectory'

import MapPins01 from '../../components/blocks/MapPins01.vue'
import DirectorySearchField from '../../components/common/DirectorySearchField.vue'
import DirectorySelect from '../../components/common/DirectorySelect.vue'
import DirectoryToggleGroup from '../../components/common/DirectoryToggleGroup.vue'
import EventsAgendaView from './EventsAgendaView.vue'
import EventsCardsView from './EventsCardsView.vue'
import { directoryEvents, eventsDerivedAt } from '../../data/events'
import { translationsFor } from '../../i18n/translations'
import {
  DIRECTORY_FILTER_ALL,
  EVENT_CATEGORIES,
  EVENT_ORGANIZERS,
  defaultDirectoryFilters,
  directoryRows,
  filterDirectoryEvents
} from '../../utils/eventsDirectory'
import EventsDirectoryList from './EventsDirectoryList.vue'

const {
  locale = 'en',
  events = directoryEvents,
  derivedAt = eventsDerivedAt
} = defineProps<{
  locale?: Locale
  events?: readonly ComfyEvent[]
  derivedAt?: Date
}>()
const { t } = translationsFor(locale)

// Search, type and organizer feed whichever view is active, so the whole
// section is one reactive model: three filter fields plus the view. Everything
// else, the visible events and the live count, is derived.
const filters = reactive(defaultDirectoryFilters())
const view = ref<EventsDirectoryView>('map')
const sort = ref<'latest' | 'oldest'>('latest')

const visibleEvents = computed(() =>
  filterDirectoryEvents(events, filters, locale)
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
  directoryRows(sortedEvents.value, locale, derivedAt)
)

// Pins are the filtered events that have coordinates; virtual events stay in
// the list and never reach the map. The block takes a generic markers prop, so
// the events -> markers mapping lives here rather than inside it.
const markers = computed<MapPinMarker[]>(() =>
  rows.value.flatMap((row) =>
    row.event.coords
      ? [
          {
            id: row.event.id,
            coords: row.event.coords,
            label: row.title,
            meta: [row.date, row.location].filter(Boolean).join(' · ')
          }
        ]
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
  t('events.directory.clusterLabel', { count: labels.length })

// Heading of the popup a still-coincident cluster opens on the map.
const clusterPopupTitle = (count: number) =>
  t('events.directory.clusterPopupTitle', { count })

const countLabel = computed(() => {
  const count = visibleEvents.value.length
  const key =
    count === 1 ? 'events.directory.countOne' : 'events.directory.count'
  return t(key, { count })
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
const viewOptions = VIEWS.map(({ key, icon }) => ({
  value: key,
  icon,
  label: t(`events.directory.view.${key}`)
}))

const categoryOptions = [
  { value: DIRECTORY_FILTER_ALL, label: t('events.directory.allTypes') },
  ...EVENT_CATEGORIES.map((category) => ({
    value: category,
    label: t(`events.category.${category}`)
  }))
]

const organizerOptions = [
  { value: DIRECTORY_FILTER_ALL, label: t('events.directory.allOrganizers') },
  ...EVENT_ORGANIZERS.map((organizer) => ({
    value: organizer,
    label: t(`events.organizer.${organizer}`)
  }))
]

const sortOptions = [
  { value: 'latest', label: t('events.directory.sortLatest') },
  { value: 'oldest', label: t('events.directory.sortOldest') }
] as const
</script>

<template>
  <section
    id="events-directory"
    class="mx-auto max-w-9xl scroll-mt-24 px-6 py-16 lg:px-20 lg:py-24"
  >
    <div class="mx-auto max-w-3xl text-center">
      <p
        class="text-xs font-semibold tracking-widest text-primary-comfy-yellow uppercase"
        aria-live="polite"
      >
        {{ countLabel }}
      </p>

      <h2
        class="mt-4 text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ t('events.directory.title') }}
      </h2>

      <p
        class="mt-6 text-base font-light text-balance text-primary-comfy-canvas lg:text-lg"
      >
        {{ t('events.directory.lead') }}
      </p>
    </div>

    <div
      class="mt-10 flex flex-col gap-3 lg:mt-12 lg:flex-row lg:items-center"
      data-testid="events-directory-controls"
    >
      <DirectorySearchField
        id="events-directory-search"
        v-model="filters.query"
        :label="t('events.directory.searchLabel')"
        :placeholder="t('events.directory.searchPlaceholder')"
      />

      <DirectorySelect
        id="events-directory-type"
        v-model="filters.category"
        :label="t('events.directory.typeLabel')"
        :options="categoryOptions"
        class="sm:w-fit"
      />

      <DirectorySelect
        id="events-directory-organizer"
        v-model="filters.organizer"
        :label="t('events.directory.organizerLabel')"
        :options="organizerOptions"
        class="sm:w-fit"
      />

      <DirectorySelect
        v-if="view !== 'calendar'"
        id="events-directory-sort"
        v-model="sort"
        :label="t('events.directory.sortLabel')"
        :options="sortOptions"
        class="sm:w-fit"
      />

      <DirectoryToggleGroup
        v-model="view"
        :label="t('events.directory.viewLabel')"
        :options="viewOptions"
      />
    </div>

    <div
      v-if="view === 'map'"
      class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[54fr_46fr]"
    >
      <MapPins01
        :markers
        :region-label="t('events.directory.mapLabel')"
        :cluster-label="clusterLabel"
        :popup-title="clusterPopupTitle"
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
