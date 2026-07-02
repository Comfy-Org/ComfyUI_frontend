<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import type { ValidFavoritedWidget } from '@/stores/workspace/favoritedWidgetsStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import { searchWidgets } from '../shared'
import PanelSearchHeader from './PanelSearchHeader.vue'
import SectionWidgets from './SectionWidgets.vue'

const favoritedWidgetsStore = useFavoritedWidgetsStore()
const rightSidePanelStore = useRightSidePanelStore()
const { searchQuery } = storeToRefs(rightSidePanelStore)
const { t } = useI18n()

const isSearching = ref(false)

const favoritedWidgets = computed(
  () => favoritedWidgetsStore.validFavoritedWidgets
)

const label = computed(() =>
  favoritedWidgets.value.length === 0
    ? t('rightSidePanel.favoritesNone')
    : t('rightSidePanel.favorites')
)

const searchedFavoritedWidgets = shallowRef<ValidFavoritedWidget[]>(
  favoritedWidgets.value
)

async function searcher(query: string) {
  isSearching.value = query.trim().length > 0
  searchedFavoritedWidgets.value = searchWidgets(favoritedWidgets.value, query)
}

function handleReorder({
  fromIndex,
  toIndex
}: {
  fromIndex: number
  toIndex: number
}) {
  const widgets = [...searchedFavoritedWidgets.value]
  const [moved] = widgets.splice(fromIndex, 1)
  if (!moved) return
  widgets.splice(toIndex, 0, moved)

  searchedFavoritedWidgets.value = widgets
  favoritedWidgetsStore.reorderFavorites(widgets)
}
</script>

<template>
  <PanelSearchHeader
    v-model="searchQuery"
    :searcher
    :update-key="favoritedWidgets"
  />
  <SectionWidgets
    :label
    :widgets="searchedFavoritedWidgets"
    :is-draggable="!isSearching"
    hidden-favorite-indicator
    show-node-name
    enable-empty-state
    class="border-b border-interface-stroke"
    @reorder="handleReorder"
  >
    <template #empty>
      <div class="px-4 py-10 text-center text-sm text-muted-foreground">
        <p>
          {{
            isSearching
              ? t('rightSidePanel.noneSearchDesc')
              : t('rightSidePanel.favoritesNoneDesc')
          }}
        </p>
        <i18n-t
          v-if="!isSearching"
          keypath="rightSidePanel.favoritesNoneHint"
          tag="p"
          class="mt-2 text-xs"
        >
          <template #moreIcon>
            <span
              aria-hidden="true"
              class="text-secondary-foreground inline-flex size-5 items-center justify-center rounded-md bg-secondary-background-hover align-middle"
            >
              <i class="icon-[lucide--more-vertical] text-sm" />
            </span>
          </template>
        </i18n-t>
      </div>
    </template>
  </SectionWidgets>
</template>
