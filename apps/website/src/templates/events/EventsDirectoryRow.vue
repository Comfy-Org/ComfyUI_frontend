<script setup lang="ts">
import { CalendarDays, MapPin } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import Badge from '../../components/ui/badge/Badge.vue'
import EventsDirectoryCta from './EventsDirectoryCta.vue'

const {
  row,
  locale = 'en',
  selected = false
} = defineProps<{
  row: DirectoryRow
  locale?: Locale
  /** The map view rings the row whose pin was clicked. */
  selected?: boolean
}>()

// One row markup for the list and the agenda, so the two views cannot drift.
const metaClass = 'flex items-center gap-1 text-primary-comfy-canvas/70'
</script>

<template>
  <li
    :data-event-id="row.event.id"
    :class="
      cn(
        'flex gap-3 px-6 py-4 transition-colors',
        selected &&
          'bg-primary-comfy-yellow/10 ring-primary-comfy-yellow/40 ring-1 ring-inset'
      )
    "
    data-testid="events-directory-row"
  >
    <!-- A video's poster stands in here; a <video> is not worth it at this
    size. Narrower on phones, where the row runs the full page width. -->
    <img
      v-if="row.media && (!row.media.isVideo || row.media.poster)"
      :src="row.media.isVideo ? row.media.poster : row.media.src"
      :alt="row.media.alt"
      loading="lazy"
      decoding="async"
      class="aspect-16/10 w-24 shrink-0 rounded-xl object-cover sm:w-32"
    />

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <Badge variant="category" size="xs" class="self-start">
        {{ row.category }}
      </Badge>

      <h3 class="truncate text-sm font-light text-primary-warm-white">
        {{ row.title }}
      </h3>

      <p class="line-clamp-2 text-[11px] text-primary-comfy-canvas/70">
        {{ row.description }}
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

        <EventsDirectoryCta :row :locale />
      </div>
    </div>
  </li>
</template>
