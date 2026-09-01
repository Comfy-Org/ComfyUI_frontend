<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import type { GalleryItem } from './GallerySection.vue'

const {
  item,
  highlightClass = 'text-primary-comfy-yellow',
  locale = 'en'
} = defineProps<{
  item: GalleryItem
  highlightClass?: string
  locale?: Locale
}>()
</script>

<template>
  <span class="inline-flex flex-wrap gap-1">
    <span>{{ t('gallery.card.by', locale) }}</span>
    <span :class="highlightClass">{{ item.userAlias }}</span>
    <template v-if="item.teamAlias">
      <span>{{ t('gallery.card.and', locale) }}</span>
      <span :class="highlightClass">{{ item.teamAlias }}</span>
      <span>{{ t('gallery.card.teamUsing', locale) }}</span>
    </template>
    <template v-else>
      <span>{{ t('gallery.card.using', locale) }}</span>
    </template>
    <span :class="highlightClass">{{ item.tool }}</span>
  </span>
</template>
