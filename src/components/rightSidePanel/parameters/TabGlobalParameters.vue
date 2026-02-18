<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import DraggableList from '@/components/common/DraggableList.vue'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'
import type { ValidFavoritedWidget } from '@/stores/workspace/favoritedWidgetsStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import { searchWidgets } from '../shared'
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
</script>

<template>
  <div class="px-4 pt-1 pb-4 flex gap-2 border-b border-interface-stroke">
    <FormSearchInput
      v-model="searchQuery"
      :searcher
      :update-key="favoritedWidgets"
    />
  </div>
  <DraggableList
    v-model="searchedFavoritedWidgets"
    @update:model-value="favoritedWidgetsStore.reorderFavorites"
  >
    <SectionWidgets
      :label
      :widgets="searchedFavoritedWidgets"
      :is-draggable="!isSearching"
      hidden-favorite-indicator
      show-node-name
      enable-empty-state
      class="border-b border-interface-stroke"
    >
      <template #empty>
        <div class="text-sm text-muted-foreground px-4 text-center py-10">
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
                class="inline-flex size-5 items-center justify-center rounded-md bg-secondary-background-hover text-secondary-foreground align-middle"
              >
                <i class="icon-[lucide--more-vertical] text-sm" />
              </span>
            </template>
          </i18n-t>
        </div>
      </template>
    </SectionWidgets>
  </DraggableList>
</template>
