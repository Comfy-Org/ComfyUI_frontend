<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore';
import type { ValidFavoritedWidget } from '@/stores/workspace/favoritedWidgetsStore';

import { searchWidgets } from '../layout'
import SidePanelSearch from '../layout/SidePanelSearch.vue'
import SectionWidgets from './SectionWidgets.vue'

const favoritedWidgetsStore = useFavoritedWidgetsStore()
const { t } = useI18n()

const favoritedWidgets = computed(
  () => favoritedWidgetsStore.validFavoritedWidgets
)

const label = computed(() =>
  favoritedWidgets.value.length === 0
    ? t('rightSidePanel.favoritesNone')
    : t('rightSidePanel.favorites')
)

const searchedFavoritedWidgets = shallowRef<ValidFavoritedWidget[]>([])

async function searcher(query: string) {
  searchedFavoritedWidgets.value = searchWidgets(favoritedWidgets.value, query)
}
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher />
  </div>
  <SectionWidgets
    :label
    :widgets="searchedFavoritedWidgets"
    class="border-b border-interface-stroke"
  />
</template>
