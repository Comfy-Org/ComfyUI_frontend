<script setup lang="ts">
import { computed, ref } from 'vue'

import { CalendarDays, MapPin } from '@lucide/vue'
import { useResizeObserver } from '@vueuse/core'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import Badge from '../../components/ui/badge/Badge.vue'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'
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

// The whole row links to the event's destination — the watch page for past
// events, the outbound registration or stream page for upcoming ones — via
// a CardArticle01-style overlay. The chips and Read more sit above it.
const rowLink = computed(() => row.watch ?? row.register)
const rowLinkTarget = computed(() =>
  rowLink.value?.newTab ? '_blank' : undefined
)
const rowLinkRel = computed(() =>
  rowLinkTarget.value ? resolveRel({ target: rowLinkTarget.value }) : undefined
)

const thumbnail = computed(() => {
  const media = row.media
  if (!media) return undefined
  if (!media.isVideo) return { src: media.src, alt: media.alt }
  if (!media.poster) return undefined
  return { src: media.poster, alt: media.alt }
})

const descEl = ref<HTMLElement>()
const clamped = ref(false)
const expanded = ref(false)
const expansionLabel = computed(() =>
  t(
    expanded.value ? 'events.directory.readLess' : 'events.directory.readMore',
    locale
  )
)
// A clamped paragraph overflows its own box; re-measuring on resize keeps
// the Read more affordance honest as the list column changes width. While
// expanded nothing overflows, so the last measurement is kept.
useResizeObserver(descEl, ([entry]) => {
  if (expanded.value) return
  clamped.value = entry.target.scrollHeight > entry.target.clientHeight + 1
})
</script>

<template>
  <li
    :data-event-id="row.event.id"
    :aria-current="selected ? 'true' : undefined"
    :class="
      cn(
        'relative isolate flex gap-3 px-6 py-5 transition-colors',
        rowLink && 'hover:bg-white/5',
        selected &&
          'bg-primary-comfy-yellow/10 ring-primary-comfy-yellow/40 ring-1 ring-inset'
      )
    "
    data-testid="events-directory-row"
  >
    <a
      v-if="rowLink"
      :href="rowLink.href"
      :target="rowLinkTarget"
      :rel="rowLinkRel"
      :aria-label="`${row.title} — ${rowLink.label}`"
      class="focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    />
    <!-- A video's poster stands in here; a <video> is not worth it at this
    size. Hidden on phones, where the row runs the full page width and the
    text needs every column. -->
    <img
      v-if="thumbnail"
      :src="thumbnail.src"
      :alt="thumbnail.alt"
      loading="lazy"
      decoding="async"
      class="hidden aspect-16/10 w-36 shrink-0 self-start rounded-xl object-cover sm:block"
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
        class="relative z-20 self-start text-[11px] font-semibold text-primary-comfy-canvas/70 transition-colors hover:text-primary-warm-white"
        @click.stop="expanded = !expanded"
      >
        {{ expansionLabel }}
      </button>

      <div
        class="relative z-20 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]"
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
