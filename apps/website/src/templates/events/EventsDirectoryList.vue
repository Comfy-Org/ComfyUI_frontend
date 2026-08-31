<script setup lang="ts">
import { CalendarDays, MapPin } from '@lucide/vue'
import { computed, nextTick, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ComfyEvent } from '../../data/events'
import type { Locale } from '../../i18n/translations'

import AddToCalendarButton from '../../components/blocks/AddToCalendarButton.vue'
import Badge from '../../components/ui/badge/Badge.vue'
import { localizeHref } from '../../config/routes'
import {
  eventPath,
  eventStatus,
  eventVideoId,
  toCalendarEvent
} from '../../data/events'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'
import { eventDateLabel } from '../../utils/eventsDirectory'

const {
  events,
  locale = 'en',
  selectedEventId = null
} = defineProps<{
  events: readonly ComfyEvent[]
  locale?: Locale
  /** The event whose map pin was clicked; its row highlights and scrolls in. */
  selectedEventId?: string | null
}>()

// `directoryEvents` is already split into upcoming-then-past against the
// module's load-time clock; classifying a row only needs the same boundary, not
// a second reactive clock.
const NOW = new Date()

type DirectoryRow = {
  event: ComfyEvent
  category: string
  date: string
  location: string
  thumbnail?: { src: string; alt: string }
  /** Past rows link out; upcoming rows offer the calendar menu instead. */
  watch?: { href: string; newTab: boolean }
  calendar?: ReturnType<typeof toCalendarEvent>
}

/** Video card art is not worth a <video> element at 152px wide, so a video
 * only contributes a thumbnail when it has a poster. */
function thumbnailOf(event: ComfyEvent): DirectoryRow['thumbnail'] {
  const media = event.media ?? event.featured?.media
  if (!media) return undefined
  const src = media.type === 'video' ? media.poster : media.src
  if (!src) return undefined
  return { src, alt: media.alt[locale] }
}

/** Mirrors the past-gallery cards: a recording opens its own /events/[slug]
 * page, anything else links out to the event's own page. */
function watchOf(event: ComfyEvent): DirectoryRow['watch'] {
  const pageHref = localizeHref(eventPath(event), locale)
  if (eventVideoId(event)) return { href: pageHref, newTab: false }
  if (!event.link) return undefined
  return { href: event.link.href[locale], newTab: event.link.newTab ?? false }
}

const rows = computed<DirectoryRow[]>(() =>
  events.map((event) => {
    const upcoming = eventStatus(event, NOW) === 'upcoming'
    return {
      event,
      category: t(`events.category.${event.category}`, locale),
      date: eventDateLabel(event, locale),
      location:
        event.location?.[locale] ?? t('events.directory.virtual', locale),
      thumbnail: thumbnailOf(event),
      watch: upcoming ? undefined : watchOf(event),
      calendar: upcoming ? toCalendarEvent(event, locale) : undefined
    }
  })
)

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

const metaClass = 'flex items-center gap-1 text-primary-comfy-canvas/70'

// Shared by the two row CTAs — the calendar-menu trigger and the watch link.
const chipClass =
  'cursor-pointer rounded-full border border-primary-comfy-yellow/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary-comfy-yellow uppercase transition-colors hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
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
      <li
        v-for="row in rows"
        :key="row.event.id"
        :data-event-id="row.event.id"
        :class="
          cn(
            'flex gap-3 px-6 py-4 transition-colors',
            row.event.id === selectedEventId &&
              'bg-primary-comfy-yellow/10 ring-primary-comfy-yellow/40 ring-1 ring-inset'
          )
        "
        data-testid="events-directory-row"
      >
        <img
          v-if="row.thumbnail"
          :src="row.thumbnail.src"
          :alt="row.thumbnail.alt"
          loading="lazy"
          decoding="async"
          class="aspect-16/10 w-32 shrink-0 rounded-xl object-cover"
        />

        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <Badge variant="category" size="xs" class="self-start">
            {{ row.category }}
          </Badge>

          <h3 class="truncate text-sm font-light text-primary-warm-white">
            {{ row.event.title[locale] }}
          </h3>

          <p class="line-clamp-2 text-[11px] text-primary-comfy-canvas/70">
            {{ row.event.description[locale] }}
          </p>

          <div
            class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]"
          >
            <span :class="metaClass">
              <MapPin class="size-3" aria-hidden="true" />
              {{ row.location }}
            </span>
            <span :class="metaClass">
              <CalendarDays class="size-3" aria-hidden="true" />
              {{ row.date }}
            </span>

            <AddToCalendarButton
              v-if="row.calendar"
              :event="row.calendar"
              :locale
            >
              <template #trigger>
                <button type="button" :class="chipClass">
                  {{ t('events.directory.saveTheDate', locale) }}
                </button>
              </template>
            </AddToCalendarButton>

            <a
              v-else-if="row.watch"
              :href="row.watch.href"
              :target="row.watch.newTab ? '_blank' : undefined"
              :rel="
                row.watch.newTab ? resolveRel({ target: '_blank' }) : undefined
              "
              :class="chipClass"
            >
              {{ t('events.past.watchNow', locale) }}
            </a>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
