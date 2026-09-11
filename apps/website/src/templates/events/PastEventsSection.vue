<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { localizeHref } from '../../config/routes'
import { eventPath, eventVideoId, pastEvents } from '../../data/events'
import { t } from '../../i18n/translations'
import {
  PAST_EVENTS_PAGE_SIZE,
  pastCtaLabel
} from '../../utils/eventsDirectory'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const CATEGORY_ORDER = [
  'livestream',
  'workshop',
  'hackathon',
  'meetup',
  'conference'
] as const

// Numeric date in the locale's own field order, from the authored date part
// of the ISO string; slicing instead of new Date() keeps the event-local
// calendar date regardless of the viewer's timezone.
function cardDate(iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}

const items = computed<CardArticleGalleryItem[]>(() =>
  pastEvents.map((event) => {
    // Carousel art is sized and hosted for the hero slider only, so no
    // featured.media fallback here. An event without dedicated card art still
    // gets a card; CardArticle01 fills the media slot with a brand gradient.
    const media = event.media
    // Events with a recording open their own page (dialog over the directory);
    // the rest link out to the event's external page in a new tab.
    const pageHref = localizeHref(eventPath(event), locale)
    const external = !eventVideoId(event)
    return {
      id: event.id,
      filterKey: event.category,
      category: t(`events.category.${event.category}`, locale),
      title: event.title[locale] || event.title.en,
      date: cardDate(event.startDateTime),
      media: media && {
        type: media.type,
        src: media.src,
        alt: media.alt[locale] || media.alt.en,
        poster: media.type === 'video' ? media.poster : undefined
      },
      // Mirrors `watchOf`: an unrecorded event with no external link gets no
      // CTA at all — its /events/[slug] page does not exist.
      cta: !external
        ? { label: pastCtaLabel(event, locale), href: pageHref }
        : event.link
          ? {
              label: pastCtaLabel(event, locale),
              href: event.link.href[locale] || event.link.href.en,
              newTab: event.link.newTab
            }
          : undefined
    }
  })
)

// Only categories that actually have a card get a tab; an empty filter would
// render a blank gallery.
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
    :page-size="PAST_EVENTS_PAGE_SIZE"
    :load-more-label="t('events.past.loadMore', locale)"
  />
</template>
