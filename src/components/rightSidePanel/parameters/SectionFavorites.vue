<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

import SectionWidgets from './SectionWidgets.vue'

const favoritedWidgetsStore = useFavoritedWidgetsStore()
const { t } = useI18n()

const favoritedWidgets = computed(() => {
  return favoritedWidgetsStore.validFavoritedWidgets.map((fw) => ({
    widget: fw.widget!,
    node: fw.node!
  }))
})

const label = computed(() =>
  favoritedWidgets.value.length === 0
    ? t('rightSidePanel.favoritesNone')
    : t('rightSidePanel.favorites')
)
</script>

<template>
  <SectionWidgets :label :widgets="favoritedWidgets" />
</template>
