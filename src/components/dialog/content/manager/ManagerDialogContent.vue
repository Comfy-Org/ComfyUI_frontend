<template>
  <div
    class="flex flex-col mx-auto overflow-hidden h-[83vh] relative"
    :aria-label="$t('manager.title')"
  >
    <Button
      v-if="isSmallScreen"
      :icon="isSideNavOpen ? 'pi pi-chevron-left' : 'pi pi-chevron-right'"
      text
      class="absolute top-1/2 -translate-y-1/2 z-10"
      :class="isSideNavOpen ? 'left-[19rem]' : 'left-2'"
      @click="toggleSideNav"
    />
    <div class="flex flex-1 relative overflow-hidden">
      <ManagerNavSidebar
        v-if="isSideNavOpen"
        :tabs="tabs"
        :selected-tab="selectedTab"
        @update:selected-tab="handleTabSelection"
      />
      <div
        class="flex-1 overflow-auto"
        :class="{
          'transition-all duration-300': isSmallScreen,
          'pl-80': isSideNavOpen || !isSmallScreen,
          'pl-8': !isSideNavOpen && isSmallScreen,
          'pr-80': showInfoPanel
        }"
      >
        <div class="px-6 pt-6 flex flex-col h-full">
          <RegistrySearchBar
            v-if="!hideSearchBar"
            v-model:searchQuery="searchQuery"
            :searchResults="searchResults"
            @update:sortBy="handleSortChange"
            @update:filterBy="handleFilterChange"
          />
          <div class="flex-1 overflow-auto">
            <NoResultsPlaceholder
              v-if="error || searchResults.length === 0"
              :title="
                error
                  ? $t('manager.errorConnecting')
                  : $t('manager.noResultsFound')
              "
              :message="
                error
                  ? $t('manager.tryAgainLater')
                  : $t('manager.tryDifferentSearch')
              "
            />
            <div
              v-else-if="isLoading"
              class="flex justify-center items-center h-full"
            >
              <ProgressSpinner />
            </div>
            <div v-else class="h-full" @click="handleGridContainerClick">
              <VirtualGrid
                :items="resultsWithKeys"
                :defaultItemSize="DEFAULT_CARD_SIZE"
                class="p-0 m-0 max-w-full"
                :buffer-rows="2"
                :gridStyle="{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${DEFAULT_CARD_SIZE}px, 1fr))`,
                  padding: '0.5rem',
                  gap: '1.125rem 1.25rem',
                  justifyContent: 'stretch'
                }"
              >
                <template #item="{ item }">
                  <div
                    class="relative w-full aspect-square cursor-pointer"
                    @click.stop="(event) => selectNodePack(item, event)"
                  >
                    <PackCard
                      :node-pack="item"
                      :is-selected="
                        selectedNodePacks.some((pack) => pack.id === item.id)
                      "
                    />
                  </div>
                </template>
              </VirtualGrid>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="showInfoPanel"
        class="w-80 border-l-0 border-surface-border absolute right-0 top-0 bottom-0 flex z-20"
      >
        <ContentDivider orientation="vertical" :width="0.2" />
        <div class="flex-1 flex flex-col isolate">
          <InfoPanel
            v-if="!hasMultipleSelections"
            :node-pack="selectedNodePack"
          />
          <InfoPanelMultiItem v-else :node-packs="selectedNodePacks" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import ManagerNavSidebar from '@/components/dialog/content/manager/ManagerNavSidebar.vue'
import InfoPanel from '@/components/dialog/content/manager/infoPanel/InfoPanel.vue'
import InfoPanelMultiItem from '@/components/dialog/content/manager/infoPanel/InfoPanelMultiItem.vue'
import PackCard from '@/components/dialog/content/manager/packCard/PackCard.vue'
import RegistrySearchBar from '@/components/dialog/content/manager/registrySearchBar/RegistrySearchBar.vue'
import { useResponsiveCollapse } from '@/composables/element/useResponsiveCollapse'
import { useRegistrySearch } from '@/composables/useRegistrySearch'
import type { NodeField, TabItem } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_CARD_SIZE = 512

const {
  isSmallScreen,
  isOpen: isSideNavOpen,
  toggle: toggleSideNav
} = useResponsiveCollapse()
const hideSearchBar = computed(() => isSmallScreen.value && showInfoPanel.value)

const tabs = ref<TabItem[]>([
  { id: 'all', label: 'All', icon: 'pi-list' },
  { id: 'community', label: 'Community', icon: 'pi-globe' },
  { id: 'installed', label: 'Installed', icon: 'pi-box' }
])
const selectedTab = ref<TabItem>(tabs.value[0])
const handleTabSelection = (tab: TabItem) => {
  selectedTab.value = tab
}

const { searchQuery, pageNumber, sortField, isLoading, error, searchResults } =
  useRegistrySearch()
pageNumber.value = 1
const resultsWithKeys = computed(() =>
  searchResults.value.map((item) => ({
    ...item,
    key: item.id || item.name
  }))
)

const selectedNodePacks = ref<components['schemas']['Node'][]>([])
const selectedNodePack = computed(() =>
  selectedNodePacks.value.length === 1 ? selectedNodePacks.value[0] : null
)

const selectNodePack = (
  nodePack: components['schemas']['Node'],
  event: MouseEvent
) => {
  // Handle multi-select with Shift or Ctrl/Cmd key
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    const index = selectedNodePacks.value.findIndex(
      (pack) => pack.id === nodePack.id
    )

    if (index === -1) {
      // Add to selection if not already selected
      selectedNodePacks.value.push(nodePack)
    } else {
      // Remove from selection if already selected
      selectedNodePacks.value.splice(index, 1)
    }
  } else {
    // Single select behavior
    selectedNodePacks.value = [nodePack]
  }
}

const unSelectItems = () => {
  selectedNodePacks.value = []
}
const handleGridContainerClick = (event: MouseEvent) => {
  const targetElement = event.target as HTMLElement
  if (targetElement && !targetElement.closest('[data-virtual-grid-item]')) {
    unSelectItems()
  }
}

const showInfoPanel = computed(() => selectedNodePacks.value.length > 0)
const hasMultipleSelections = computed(() => selectedNodePacks.value.length > 1)

const currentFilterBy = ref('all')
const handleSortChange = (sortBy: NodeField) => {
  sortField.value = sortBy
}
const handleFilterChange = (filterBy: NodeField) => {
  currentFilterBy.value = filterBy
}
</script>
