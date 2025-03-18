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
        v-model:selectedTab="selectedTab"
      />
      <div
        class="flex-1 overflow-auto pr-80"
        :class="{
          'transition-all duration-300': isSmallScreen,
          'pl-80': isSideNavOpen || !isSmallScreen,
          'pl-8': !isSideNavOpen && isSmallScreen
        }"
      >
        <div class="px-6 pt-6 flex flex-col h-full">
          <RegistrySearchBar
            v-model:searchQuery="searchQuery"
            v-model:searchMode="searchMode"
            :searchResults="searchResults"
            :suggestions="suggestions"
          />
          <div class="flex-1 overflow-auto">
            <div
              v-if="isLoading"
              class="flex justify-center items-center h-full"
            >
              <ProgressSpinner />
            </div>
            <NoResultsPlaceholder
              v-else-if="searchResults.length === 0"
              :title="
                comfyManagerStore.error
                  ? $t('manager.errorConnecting')
                  : $t('manager.noResultsFound')
              "
              :message="
                comfyManagerStore.error
                  ? $t('manager.tryAgainLater')
                  : $t('manager.tryDifferentSearch')
              "
            />
            <div v-else class="h-full" @click="handleGridContainerClick">
              <VirtualGrid
                :items="resultsWithKeys"
                :buffer-rows="3"
                :gridStyle="{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(19rem, 1fr))',
                  padding: '0.5rem',
                  gap: '1.5rem'
                }"
                @approach-end="onApproachEnd"
              >
                <template #item="{ item }">
                  <PackCard
                    @click.stop="(event) => selectNodePack(item, event)"
                    :node-pack="item"
                    :is-selected="
                      selectedNodePacks.some((pack) => pack.id === item.id)
                    "
                  />
                </template>
              </VirtualGrid>
            </div>
          </div>
        </div>
      </div>
      <div
        class="w-80 border-l-0 border-surface-border absolute right-0 top-0 bottom-0 flex z-20"
      >
        <ContentDivider orientation="vertical" :width="0.2" />
        <div class="flex-1 flex flex-col isolate">
          <InfoPanel
            v-if="!hasMultipleSelections && selectedNodePack"
            :node-pack="selectedNodePack"
          />
          <InfoPanelMultiItem v-else :node-packs="selectedNodePacks" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import ManagerNavSidebar from '@/components/dialog/content/manager/ManagerNavSidebar.vue'
import InfoPanel from '@/components/dialog/content/manager/infoPanel/InfoPanel.vue'
import InfoPanelMultiItem from '@/components/dialog/content/manager/infoPanel/InfoPanelMultiItem.vue'
import PackCard from '@/components/dialog/content/manager/packCard/PackCard.vue'
import RegistrySearchBar from '@/components/dialog/content/manager/registrySearchBar/RegistrySearchBar.vue'
import { useResponsiveCollapse } from '@/composables/element/useResponsiveCollapse'
import { useInstalledPacks } from '@/composables/nodePack/useInstalledPacks'
import { useWorkflowPacks } from '@/composables/nodePack/useWorkflowPacks'
import { useRegistrySearch } from '@/composables/useRegistrySearch'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { TabItem } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

enum ManagerTab {
  All = 'all',
  Installed = 'installed',
  Workflow = 'workflow',
  Missing = 'missing'
}

const { t } = useI18n()
const comfyManagerStore = useComfyManagerStore()

const {
  isSmallScreen,
  isOpen: isSideNavOpen,
  toggle: toggleSideNav
} = useResponsiveCollapse()

const tabs = ref<TabItem[]>([
  { id: ManagerTab.All, label: t('g.all'), icon: 'pi-list' },
  { id: ManagerTab.Installed, label: t('g.installed'), icon: 'pi-box' },
  {
    id: ManagerTab.Workflow,
    label: t('manager.inWorkflow'),
    icon: 'pi-folder'
  },
  {
    id: ManagerTab.Missing,
    label: t('g.missing'),
    icon: 'pi-exclamation-circle'
  }
])
const selectedTab = ref<TabItem>(tabs.value[0])

const {
  searchQuery,
  pageNumber,
  isLoading: isSearchLoading,
  searchResults,
  searchMode,
  suggestions
} = useRegistrySearch()
pageNumber.value = 0
const onApproachEnd = () => {
  pageNumber.value++
}

const isInitialLoad = computed(
  () => searchResults.value.length === 0 && searchQuery.value === ''
)

const isEmptySearch = computed(() => searchQuery.value === '')
const displayPacks = ref<components['schemas']['Node'][]>([])

const {
  startFetchInstalled,
  filterInstalledPack,
  installedPacks,
  isLoading: isLoadingInstalled
} = useInstalledPacks()

const {
  startFetchWorkflowPacks,
  filterWorkflowPack,
  workflowPacks,
  isLoading: isLoadingWorkflow
} = useWorkflowPacks()

const getInstalledResults = () => {
  if (isEmptySearch.value) {
    startFetchInstalled()
    return installedPacks.value
  } else {
    return filterInstalledPack(searchResults.value)
  }
}

const getInWorkflowResults = () => {
  if (isEmptySearch.value) {
    startFetchWorkflowPacks()
    return workflowPacks.value
  } else {
    return filterWorkflowPack(searchResults.value)
  }
}

const filterMissingPacks = (packs: components['schemas']['Node'][]) =>
  packs.filter((pack) => !comfyManagerStore.isPackInstalled(pack.id))

const getMissingPacks = () => filterMissingPacks(getInWorkflowResults())

const onTabChange = () => {
  switch (selectedTab.value?.id) {
    case ManagerTab.Installed:
      displayPacks.value = getInstalledResults()
      break
    case ManagerTab.Workflow:
      displayPacks.value = getInWorkflowResults()
      break
    case ManagerTab.Missing:
      displayPacks.value = getMissingPacks()
      break
    default:
      displayPacks.value = searchResults.value
  }
}

const onResultsChange = () => {
  switch (selectedTab.value?.id) {
    case ManagerTab.Installed:
      displayPacks.value = filterInstalledPack(searchResults.value)
      break
    case ManagerTab.Workflow:
      displayPacks.value = filterWorkflowPack(searchResults.value)
      break
    case ManagerTab.Missing:
      displayPacks.value = filterMissingPacks(searchResults.value)
      break
    default:
      displayPacks.value = searchResults.value
  }
}

whenever(selectedTab, onTabChange)
watch(searchResults, onResultsChange, { flush: 'pre' })

const isLoading = computed(() => {
  if (isSearchLoading.value)
    return searchResults.value.length === 0 || isInitialLoad.value
  if (selectedTab.value?.id === ManagerTab.Installed) {
    return isLoadingInstalled.value
  }
  if (
    selectedTab.value?.id === ManagerTab.Workflow ||
    selectedTab.value?.id === ManagerTab.Missing
  ) {
    return isLoadingWorkflow.value
  }
  return false
})

const resultsWithKeys = computed(
  () =>
    displayPacks.value.map((item) => ({
      ...item,
      key: item.id || item.name
    })) as (components['schemas']['Node'] & { key: string })[]
)

const selectedNodePacks = ref<components['schemas']['Node'][]>([])
const selectedNodePack = computed<components['schemas']['Node'] | null>(() =>
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

const hasMultipleSelections = computed(() => selectedNodePacks.value.length > 1)
</script>
