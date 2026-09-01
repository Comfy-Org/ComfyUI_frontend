<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { drops } from '../../data/drops'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const items = computed<CardArticleGalleryItem[]>(() =>
  drops.map((drop) => ({
    id: drop.id,
    badge: drop.badge?.[locale] || drop.badge?.en,
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
    :title="t('launches.section.title', locale)"
    :items
    layout="mixed"
  />
</template>
