<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { DraggableList } from '@/scripts/ui/draggableList'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import type { ValidFavoritedWidget } from '@/stores/workspace/favoritedWidgetsStore'

import { searchWidgets } from '../layout'
import SidePanelSearch from '../layout/SidePanelSearch.vue'
import SectionWidgets from './SectionWidgets.vue'

const favoritedWidgetsStore = useFavoritedWidgetsStore()
const { t } = useI18n()

const draggableList = ref<DraggableList | undefined>(undefined)
const sectionWidgetsRef = ref<{ widgetsContainer: HTMLElement }>()
const searchQuery = ref<string>('')

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
  searchQuery.value = query
  searchedFavoritedWidgets.value = searchWidgets(favoritedWidgets.value, query)
}

function setDraggableState() {
  draggableList.value?.dispose()
  const container = sectionWidgetsRef.value?.widgetsContainer
  if (searchQuery.value || !container?.children?.length) return

  draggableList.value = new DraggableList(container, '.draggable-item')

  draggableList.value.applyNewItemsOrder = function () {
    const reorderedItems: HTMLElement[] = []

    let oldPosition = -1
    this.getAllItems().forEach((item, index) => {
      if (item === this.draggableItem) {
        oldPosition = index
        return
      }
      if (!this.isItemToggled(item)) {
        reorderedItems[index] = item
        return
      }
      const newIndex = this.isItemAbove(item) ? index + 1 : index - 1
      reorderedItems[newIndex] = item
    })

    for (let index = 0; index < this.getAllItems().length; index++) {
      const item = reorderedItems[index]
      if (typeof item === 'undefined') {
        reorderedItems[index] = this.draggableItem as HTMLElement
      }
    }

    const newPosition = reorderedItems.indexOf(
      this.draggableItem as HTMLElement
    )
    const widgets = [...searchedFavoritedWidgets.value]
    const [widget] = widgets.splice(oldPosition, 1)
    widgets.splice(newPosition, 0, widget)
    searchedFavoritedWidgets.value = widgets
    favoritedWidgetsStore.reorderFavorites(widgets)
  }
}

watchDebounced(
  searchedFavoritedWidgets,
  () => {
    setDraggableState()
  },
  { debounce: 100 }
)

onMounted(() => {
  setDraggableState()
})

onBeforeUnmount(() => {
  draggableList.value?.dispose()
})
</script>

<template>
  <div class="px-4 pb-4 flex gap-2 border-b border-interface-stroke">
    <SidePanelSearch :searcher />
  </div>
  <SectionWidgets
    ref="sectionWidgetsRef"
    :label
    :widgets="searchedFavoritedWidgets"
    :is-draggable="!searchQuery"
    hidden-favorite-indicator
    class="border-b border-interface-stroke"
  />
</template>
