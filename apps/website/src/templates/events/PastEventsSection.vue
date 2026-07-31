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
  pastEvents.map((event) => {
    // Events with a recording open their own page (dialog over the directory);
    // the rest link straight out to YouTube in a new tab.
    const external = !event.youtubeVideoId
    return {
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
        href: external
          ? event.watch.href[locale]
          : localizeHref(pastEventPath(event), locale),
        newTab: external ? event.watch.newTab : undefined
      }
    }
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
