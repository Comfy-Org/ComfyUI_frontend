<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import CardWorkflowGallery01 from '../../components/blocks/CardWorkflowGallery01.vue'
import type { CardWorkflowItem } from '../../components/blocks/CardWorkflow01.vue'
import { featuredProjects } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

const items = computed<CardWorkflowItem[]>(() =>
  featuredProjects(locale).map((project) => ({
    id: project.id,
    title: project.title,
    media: { ...project.media, alt: project.title },
    tags: project.tags
  }))
)
</script>

<template>
  <CardWorkflowGallery01
    :title="t('fdct.projects.title', locale)"
    title-align="center"
    :items
  />
</template>
