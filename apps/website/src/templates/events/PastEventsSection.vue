<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import type { ComfyEvent } from '../../utils/events'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { useClientNow } from '../../composables/useClientNow'
import { localizeHref } from '../../config/routes'
import { t } from '../../i18n/translations'
import { derivePastEvents, eventPath, eventVideoId } from '../../utils/events'

const {
  events,
  now,
  locale = 'en'
} = defineProps<{
  events: readonly ComfyEvent[]
  now: string
  locale?: Locale
}>()

const currentTime = useClientNow(now)

const items = computed<CardArticleGalleryItem[]>(() =>
  derivePastEvents(events, currentTime.value).flatMap((event) => {
    // Card art falls back to the carousel art for events that became past
    // before dedicated card art was added; a card cannot render without media.
    const media = event.media ?? event.featured?.media
    if (!media) return []
    // Events with a recording open their own page (dialog over the directory);
    // the rest link out to the event's external page in a new tab.
    const pageHref = localizeHref(eventPath(event), locale)
    const external = !eventVideoId(event)
    return [
      {
        id: event.id,
        category: t(`events.category.${event.category}`, locale),
        title: event.title,
        media: {
          type: media.type,
          src: media.src,
          alt: media.alt,
          poster: media.type === 'video' ? media.poster : undefined
        },
        cta: {
          label: t('events.past.watchNow', locale),
          href: external ? (event.href ?? pageHref) : pageHref,
          newTab: external ? event.newTab : undefined
        }
      }
    ]
  })
)
</script>

<template>
  <CardArticleGallery01
    :title="t('events.past.title', locale)"
    title-align="center"
    :items
    layout="two-column"
    title-clamp
  />
</template>
