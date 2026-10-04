<script setup lang="ts">
import type { GalleryItem } from '../../data/gallery'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const {
  item,
  highlightClass = 'text-primary-comfy-yellow',
  locale = 'en'
} = defineProps<{
  item: GalleryItem
  highlightClass?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <span class="inline-flex flex-wrap gap-1">
    <span>{{ t('gallery.card.by') }}</span>
    <span :class="highlightClass">{{ item.userAlias }}</span>
    <template v-if="item.teamAlias">
      <span>{{ t('gallery.card.and') }}</span>
      <span :class="highlightClass">{{ item.teamAlias }}</span>
      <span>{{ t('gallery.card.teamUsing') }}</span>
    </template>
    <template v-else>
      <span>{{ t('gallery.card.using') }}</span>
    </template>
    <span :class="highlightClass">{{ item.tool }}</span>
  </span>
</template>
