<script setup lang="ts">
import { CalendarDays, ChevronDown, LayoutGrid, Map, Search } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { EventsDirectoryView } from '../../utils/eventsDirectory'

import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import { directoryEvents } from '../../data/events'
import { t } from '../../i18n/translations'
import {
  DIRECTORY_FILTER_ALL,
  EVENT_CATEGORIES,
  EVENT_PROGRAMS,
  defaultDirectoryFilters,
  filterDirectoryEvents
} from '../../utils/eventsDirectory'
import EventsDirectoryList from './EventsDirectoryList.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Search ∧ type ∧ program feed whichever view is active, so the whole section
// is one reactive model: three filter fields plus the view. Everything else —
// the visible events and the live count — is derived.
const filters = reactive(defaultDirectoryFilters())
const view = ref<EventsDirectoryView>('map')

const visibleEvents = computed(() =>
  filterDirectoryEvents(directoryEvents, filters, locale)
)

// `t()` has neither interpolation nor plurals, so both are resolved here.
const countLabel = computed(() => {
  const count = visibleEvents.value.length
  const key =
    count === 1 ? 'events.directory.countOne' : 'events.directory.count'
  return t(key, locale).replace('{count}', String(count))
})

// Cards and Calendar are disabled until tickets 05 and 06 land their views;
// the tabs render so the control matches the design and those tickets only
// flip a flag and fill the slot.
const VIEWS: ReadonlyArray<{
  key: EventsDirectoryView
  icon: typeof Map
  enabled: boolean
}> = [
  { key: 'map', icon: Map, enabled: true },
  { key: 'cards', icon: LayoutGrid, enabled: false },
  { key: 'calendar', icon: CalendarDays, enabled: false }
]

const controlClass =
  'bg-transparency-white-t5 h-11 rounded-full border border-white/15 text-sm text-primary-comfy-canvas'

// `appearance-none` drops the native arrow, so each select is wrapped and gets
// a ChevronDown overlaid — the same icon the rest of the site uses.
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
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-16 lg:py-24"
  >
    <div class="mx-auto max-w-3xl text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      >
        {{ t('events.directory.title', locale) }}
      </h2>

      <p
        class="text-primary-comfy-yellow mt-4 text-xs font-semibold tracking-widest uppercase"
        aria-live="polite"
      >
        {{ countLabel }}
      </p>

      <p
        class="mt-6 text-base font-light text-balance text-primary-comfy-canvas lg:text-lg"
      >
        {{ t('events.directory.lead', locale) }}
      </p>

      <Button
        as="a"
        variant="underlineLink"
        class="mt-4 justify-center text-sm"
        :href="externalLinks.eventHostApplicationForm"
      >
        {{ t('events.hero.applyToHost', locale) }}
      </Button>
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

      <label for="events-directory-program" class="sr-only">
        {{ t('events.directory.programLabel', locale) }}
      </label>
      <div class="relative">
        <select
          id="events-directory-program"
          v-model="filters.program"
          :class="selectClass"
        >
          <option :value="DIRECTORY_FILTER_ALL">
            {{ t('events.directory.allPrograms', locale) }}
          </option>
          <option
            v-for="program in EVENT_PROGRAMS"
            :key="program"
            :value="program"
          >
            {{ t(`events.program.${program}`, locale) }}
          </option>
        </select>
        <ChevronDown :class="caretClass" aria-hidden="true" />
      </div>

      <div
        role="group"
        :aria-label="t('events.directory.viewLabel', locale)"
        class="flex gap-1 rounded-2xl border border-white/15 p-1.5"
      >
        <button
          v-for="entry in VIEWS"
          :key="entry.key"
          type="button"
          :disabled="!entry.enabled"
          :aria-pressed="view === entry.key"
          :class="
            cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-colors',
              view === entry.key
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'text-primary-comfy-canvas hover:bg-white/10',
              !entry.enabled &&
                'cursor-not-allowed opacity-40 hover:bg-transparent'
            )
          "
          @click="view = entry.key"
        >
          <component :is="entry.icon" class="size-3.5" aria-hidden="true" />
          {{ t(`events.directory.view.${entry.key}`, locale) }}
        </button>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <!-- Ticket 04 replaces this slot with the MapPins01 block. -->
      <div
        class="flex h-140 items-center justify-center rounded-3xl border-2 border-dashed border-primary-comfy-canvas/20"
      >
        <code class="text-sm text-primary-comfy-canvas/40">MapPins01</code>
      </div>

      <EventsDirectoryList :events="visibleEvents" :locale />
    </div>
  </section>
</template>
