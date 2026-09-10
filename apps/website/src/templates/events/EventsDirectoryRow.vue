<script setup lang="ts">
import { ref } from 'vue'

import { CalendarDays, MapPin } from '@lucide/vue'
import { useResizeObserver } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import Badge from '../../components/ui/badge/Badge.vue'
import { t } from '../../i18n/translations'
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

const descEl = ref<HTMLElement>()
const clamped = ref(false)
const expanded = ref(false)
// A clamped paragraph overflows its own box; re-measuring on resize keeps
// the Read more affordance honest as the list column changes width. While
// expanded nothing overflows, so the last measurement is kept.
useResizeObserver(descEl, ([entry]) => {
  if (expanded.value) return
  const el = entry.target as HTMLElement
  clamped.value = el.scrollHeight > el.clientHeight + 1
})
</script>

<template>
  <li
    :data-event-id="row.event.id"
    :aria-current="selected ? 'true' : undefined"
    :class="
      cn(
        'flex gap-3 px-6 py-5 transition-colors',
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
      class="aspect-16/10 w-28 shrink-0 rounded-xl object-cover sm:w-36"
    />

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-center gap-2 self-start">
        <Badge variant="category" size="xs">
          {{ row.category }}
        </Badge>
        <Badge
          v-if="!row.upcoming"
          variant="subtle"
          size="xxs"
          class="uppercase"
        >
          {{ t('events.directory.pastBadge', locale) }}
        </Badge>
      </div>

      <h3 class="text-sm font-light text-primary-warm-white">
        {{ row.title }}
      </h3>

      <p
        ref="descEl"
        :class="
          cn(
            'text-xs text-primary-comfy-canvas/85',
            !expanded && 'line-clamp-2'
          )
        "
      >
        {{ row.description }}
      </p>
      <button
        v-if="clamped || expanded"
        type="button"
        class="self-start text-[11px] font-semibold text-primary-comfy-canvas/70 transition-colors hover:text-primary-warm-white"
        @click.stop="expanded = !expanded"
      >
        {{
          t(
            expanded
              ? 'events.directory.readLess'
              : 'events.directory.readMore',
            locale
          )
        }}
      </button>

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
