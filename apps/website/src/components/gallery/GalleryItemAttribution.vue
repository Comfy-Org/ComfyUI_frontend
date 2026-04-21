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
  {{ t('gallery.card.by', locale) }}
  <span :class="highlightClass">{{ item.userAlias }}</span>
  <template v-if="item.teamAlias">
    {{ t('gallery.card.and', locale) }}
    <span :class="highlightClass">{{ item.teamAlias }}</span>
    {{ t('gallery.card.teamUsing', locale) }}
  </template>
  <template v-else> using </template>
  <span :class="highlightClass">{{ item.tool }}</span>
</template>
