<script setup lang="ts">
import { computed } from 'vue'

import type { Locale, LocalizedText } from '@/i18n/translations'

import CardArticleGallery01 from '@/components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '@/components/blocks/CardArticleGallery01.vue'
import type { Drop } from '@/data/drops'
import { NEW_BADGE, drops, isRecentLaunch } from '@/data/drops'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

function localize(text: LocalizedText): string {
  return text[locale] || text.en
}

// A manual `badge` always wins; otherwise a drop reads as NEW on its own for
// a short window after `launchDate`, so nobody has to remember to remove it.
function badgeFor(drop: Drop): string | undefined {
  if (drop.badge) return localize(drop.badge)
  return isRecentLaunch(drop.launchDate) ? localize(NEW_BADGE) : undefined
}

const sortedDrops = drops.toSorted(
  (a, b) => Date.parse(b.launchDate) - Date.parse(a.launchDate)
)

const items = computed<CardArticleGalleryItem[]>(() =>
  sortedDrops.map((drop) => ({
    id: drop.id,
    badge: badgeFor(drop),
    category: drop.category[locale] || drop.category.en,
    title: drop.title[locale] || drop.title.en,
    description: drop.description[locale] || drop.description.en,
    media: {
      type: drop.media.type,
      src: drop.media.src,
      alt: drop.media.alt[locale] || drop.media.alt.en,
      poster: drop.media.type === 'video' ? drop.media.poster : undefined
    },
    cta: {
      label: drop.cta.label[locale] || drop.cta.label.en,
      href: drop.cta.href[locale] || drop.cta.href.en
    }
  }))
)
</script>

<template>
  <CardArticleGallery01
    :title="t('launches.section.title')"
    :items
    layout="mixed"
  />
</template>
