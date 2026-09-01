<script setup lang="ts">
import { CalendarDays, MapPin } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import Badge from '../../components/ui/badge/Badge.vue'
import Card from '../../components/ui/card/Card.vue'
import CardContent from '../../components/ui/card/CardContent.vue'
import CardDescription from '../../components/ui/card/CardDescription.vue'
import CardFooter from '../../components/ui/card/CardFooter.vue'
import CardHeader from '../../components/ui/card/CardHeader.vue'
import CardTitle from '../../components/ui/card/CardTitle.vue'
import { t } from '../../i18n/translations'
import EventsDirectoryCta from './EventsDirectoryCta.vue'

const { rows, locale = 'en' } = defineProps<{
  rows: readonly DirectoryRow[]
  locale?: Locale
}>()

// These compose the same `ui/card` primitives as `CardArticle01` rather than
// reusing the block itself: that block turns the whole card into one link, so
// an upcoming card's SAVE THE DATE? menu would sit under the link overlay and
// never open. The card also carries location and date, which the block has no
// slot for.

const metaClass = 'flex items-center gap-1.5 text-primary-comfy-canvas/70'
</script>

<template>
  <p
    v-if="rows.length === 0"
    class="rounded-3xl border border-white/10 px-6 py-10 text-center text-sm text-primary-comfy-canvas/70"
  >
    {{ t('events.directory.empty', locale) }}
  </p>

  <ul
    v-else
    class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    :aria-label="t('events.directory.allEvents', locale)"
  >
    <li v-for="row in rows" :key="row.event.id">
      <Card
        class="h-full gap-0 overflow-hidden"
        data-testid="events-directory-card"
      >
        <CardContent v-if="row.media" class="p-2">
          <div class="aspect-video w-full overflow-hidden rounded-4xl">
            <img
              v-if="!row.media.isVideo"
              :src="row.media.src"
              :alt="row.media.alt"
              loading="lazy"
              decoding="async"
              class="size-full object-cover object-center"
            />
            <video
              v-else
              :src="row.media.src"
              :poster="row.media.poster"
              :aria-label="row.media.alt"
              autoplay
              loop
              muted
              playsinline
              preload="metadata"
              class="size-full object-cover object-center"
            />
          </div>
        </CardContent>

        <CardHeader class="gap-2 px-6 pt-6">
          <Badge variant="category">{{ row.category }}</Badge>
          <CardTitle class="line-clamp-2 pt-2 text-lg md:text-xl">
            {{ row.title }}
          </CardTitle>
          <CardDescription class="line-clamp-3">
            {{ row.description }}
          </CardDescription>
        </CardHeader>

        <CardFooter
          class="mt-auto flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-4 pb-6 text-xs"
        >
          <span :class="metaClass">
            <MapPin class="size-3.5" aria-hidden="true" />
            {{ row.location }}
          </span>
          <span :class="metaClass">
            <CalendarDays class="size-3.5" aria-hidden="true" />
            {{ row.date }}
          </span>
          <EventsDirectoryCta :row :locale />
        </CardFooter>
      </Card>
    </li>
  </ul>
</template>
