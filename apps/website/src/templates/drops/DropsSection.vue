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
    badge: drop.badge?.[locale],
    category: drop.category[locale],
    title: drop.title[locale],
    description: drop.description[locale],
    media: {
      type: drop.media.type,
      src: drop.media.src,
      alt: drop.media.alt[locale],
      poster: drop.media.poster
    },
    cta: {
      label: drop.cta.label[locale],
      href: drop.cta.href[locale]
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
