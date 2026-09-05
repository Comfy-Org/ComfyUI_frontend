<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { localizeHref } from '../../config/routes'
import { eventPath, eventVideoId, pastEvents } from '../../data/events'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const CATEGORY_ORDER = [
  'livestream',
  'workshop',
  'hackathon',
  'meetup',
  'conference'
] as const

const PAGE_SIZE = 4

const items = computed<CardArticleGalleryItem[]>(() =>
  pastEvents.flatMap((event) => {
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
        filterKey: event.category,
        category: t(`events.category.${event.category}`, locale),
        title: event.title[locale] || event.title.en,
        media: {
          type: media.type,
          src: media.src,
          alt: media.alt[locale] || media.alt.en,
          poster: media.type === 'video' ? media.poster : undefined
        },
        cta: {
          label: t('events.past.watchNow', locale),
          href: external
            ? event.link?.href[locale] || event.link?.href.en || pageHref
            : pageHref,
          newTab: external ? event.link?.newTab : undefined
        }
      }
    ]
  })
)

// Only categories that actually have a card get a tab; an empty filter would
// render a blank gallery. Derived from `items` rather than `pastEvents`,
// because a past event without card art is dropped above and so cannot fill a
// tab of its own.
const tabs = computed(() =>
  CATEGORY_ORDER.filter((category) =>
    items.value.some((item) => item.filterKey === category)
  ).map((category) => ({
    key: category,
    label: t(`events.category.${category}`, locale).toLocaleUpperCase(locale)
  }))
)
</script>

<template>
  <CardArticleGallery01
    class="lg:px-20"
    :title="t('events.past.title', locale)"
    title-align="center"
    :items
    layout="two-column"
    title-clamp
    :tabs
    :all-label="t('events.past.filterAll', locale)"
    :page-size="PAGE_SIZE"
    :load-more-label="t('events.past.loadMore', locale)"
  />
</template>
