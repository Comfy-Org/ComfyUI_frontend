<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { localizeHref } from '../../config/routes'
import { pastEvents, pastEventPath } from '../../data/events'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const items = computed<CardArticleGalleryItem[]>(() =>
  pastEvents.map((event) => ({
    id: event.id,
    category: t(`events.category.${event.category}`, locale),
    title: event.title[locale],
    media: {
      type: event.media.type,
      src: event.media.src,
      alt: event.media.alt[locale],
      poster: event.media.type === 'video' ? event.media.poster : undefined
    },
    cta: {
      label: t('events.past.watchNow', locale),
      // Events with a recording open their own page (dialog over the
      // directory); the rest link straight out to YouTube.
      href: event.youtubeVideoId
        ? localizeHref(pastEventPath(event), locale)
        : event.watch.href[locale]
    }
  }))
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
