<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardArticleGallery01 from '../../components/blocks/CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from '../../components/blocks/CardArticleGallery01.vue'
import { projects } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const items = computed<CardArticleGalleryItem[]>(() =>
  projects.map((project) => ({
    id: project.id,
    category: t(`fdct.projects.category.${project.category}`, locale),
    title: project.title,
    media: { ...project.media, alt: project.title },
    author: project.author,
    cta: {
      label: t('fdct.projects.cta', locale),
      href: project.href,
      newTab: true
    }
  }))
)
</script>

<template>
  <CardArticleGallery01
    :title="t('fdct.projects.title', locale)"
    title-align="center"
    :items
    layout="three-column"
  />
</template>
