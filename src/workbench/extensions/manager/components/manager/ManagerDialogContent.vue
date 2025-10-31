<template>
  <div
    class="mx-auto flex h-full flex-col overflow-hidden"
    :aria-label="$t('manager.title')"
  >
    <ContentDivider :width="0.3" />
    <Button
      v-if="isSmallScreen"
      :icon="isSideNavOpen ? 'pi pi-chevron-left' : 'pi pi-chevron-right'"
      severity="secondary"
      filled
      class="absolute top-1/2 z-10 -translate-y-1/2"
      :class="isSideNavOpen ? 'left-[12rem]' : 'left-2'"
      @click="toggleSideNav"
    />
    <div class="relative flex flex-1 overflow-hidden">
      <ManagerNavSidebar
        v-if="isSideNavOpen"
        v-model:selected-tab="selectedTab"
        :tabs="tabs"
      />
      <div
        class="flex-1 overflow-auto bg-gray-50 dark-theme:bg-neutral-900"
        :class="{
          'transition-all duration-300': isSmallScreen
        }"
      >
        <div class="flex h-full flex-col px-6">
          <!-- Conflict Warning Banner -->
          <div
            v-if="shouldShowManagerBanner"
            class="relative mt-3 mb-4 flex items-center gap-6 rounded-lg bg-yellow-500/20 p-4"
          >
            <i class="pi pi-exclamation-triangle text-lg text-yellow-600"></i>
            <div class="flex flex-1 flex-col gap-2">
              <p class="m-0 text-sm font-bold">
                {{ $t('manager.conflicts.warningBanner.title') }}
              </p>
              <p class="m-0 text-xs">
                {{ $t('manager.conflicts.warningBanner.message') }}
              </p>
              <p
                class="m-0 cursor-pointer text-sm font-bold"
                @click="onClickWarningLink"
              >
                {{ $t('manager.conflicts.warningBanner.button') }}
              </p>
            </div>
            <IconButton
              class="absolute top-0 right-0"
              type="transparent"
              @click="dismissWarningBanner"
            >
              <i class="pi pi-times text-xs text-base-foreground"></i>
            </IconButton>
          </div>
          <RegistrySearchBar
            v-model:search-query="searchQuery"
            v-model:search-mode="searchMode"
            v-model:sort-field="sortField"
            :search-results="searchResults"
            :suggestions="suggestions"
            :is-missing-tab="isMissingTab"
            :sort-options="sortOptions"
            :is-update-available-tab="isUpdateAvailableTab"
          />
          <div class="flex-1 overflow-auto">
            <div
              v-if="isLoading"
              class="h-full scrollbar-hide w-full overflow-auto"
            >
              <GridSkeleton :grid-style="GRID_STYLE" :skeleton-card-count />
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
                id="results-grid"
                :items="resultsWithKeys"
                :buffer-rows="4"
                :grid-style="GRID_STYLE"
                @approach-end="onApproachEnd"
              >
                <template #item="{ item }">
                  <PackCard
                    :node-pack="item"
                    :is-selected="
                      selectedNodePacks.some((pack) => pack.id === item.id)
                    "
                    @click.stop="
                      (event: MouseEvent) => selectNodePack(item, event)
                    "
                  />
                </template>
              </VirtualGrid>
            </div>
          </div>
        </div>
      </div>
      <div class="z-20 flex w-[clamp(250px,33%,306px)] border-l-0">
        <ContentDivider orientation="vertical" :width="0.2" />
        <div class="isolate flex w-full flex-col">
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
import { merge } from 'es-toolkit/compat'
import Button from 'primevue/button'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import { useResponsiveCollapse } from '@/composables/element/useResponsiveCollapse'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import ManagerNavSidebar from '@/workbench/extensions/manager/components/manager/ManagerNavSidebar.vue'
import InfoPanel from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanel.vue'
import InfoPanelMultiItem from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanelMultiItem.vue'
import PackCard from '@/workbench/extensions/manager/components/manager/packCard/PackCard.vue'
import RegistrySearchBar from '@/workbench/extensions/manager/components/manager/registrySearchBar/RegistrySearchBar.vue'
import GridSkeleton from '@/workbench/extensions/manager/components/manager/skeleton/GridSkeleton.vue'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useManagerStatePersistence } from '@/workbench/extensions/manager/composables/useManagerStatePersistence'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import type { TabItem } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { initialTab } = defineProps<{
  initialTab?: ManagerTab
}>()

const { t } = useI18n()
const comfyManagerStore = useComfyManagerStore()
const { getPackById } = useComfyRegistryStore()
const conflictAcknowledgment = useConflictAcknowledgment()
const persistedState = useManagerStatePersistence()
const initialState = persistedState.loadStoredState()

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))',
  padding: '0.5rem',
  gap: '1.5rem'
} as const

const {
  isSmallScreen,
  isOpen: isSideNavOpen,
  toggle: toggleSideNav
} = useResponsiveCollapse()

// Use conflict acknowledgment state from composable
const {
  shouldShowManagerBanner,
  dismissWarningBanner,
  dismissRedDotNotification
} = conflictAcknowledgment

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
  },
  {
    id: ManagerTab.UpdateAvailable,
    label: t('g.updateAvailable'),
    icon: 'pi-sync'
  }
])

const initialTabId = initialTab ?? initialState.selectedTabId
const selectedTab = ref<TabItem>(
  tabs.value.find((tab) => tab.id === initialTabId) || tabs.value[0]
)

const {
  searchQuery,
  pageNumber,
  isLoading: isSearchLoading,
  searchResults,
  searchMode,
  sortField,
  suggestions,
  sortOptions
} = useRegistrySearch({
  initialSortField: initialState.sortField,
  initialSearchMode: initialState.searchMode,
  initialSearchQuery: initialState.searchQuery
})
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
  isLoading: isLoadingInstalled,
  isReady: installedPacksReady
} = useInstalledPacks()

const {
  startFetchWorkflowPacks,
  filterWorkflowPack,
  workflowPacks,
  isLoading: isLoadingWorkflow,
  isReady: workflowPacksReady
} = useWorkflowPacks()

const filterMissingPacks = (packs: components['schemas']['Node'][]) =>
  packs.filter((pack) => !comfyManagerStore.isPackInstalled(pack.id))

const isUpdateAvailableTab = computed(
  () => selectedTab.value?.id === ManagerTab.UpdateAvailable
)
const isInstalledTab = computed(
  () => selectedTab.value?.id === ManagerTab.Installed
)
const isMissingTab = computed(
  () => selectedTab.value?.id === ManagerTab.Missing
)
const isWorkflowTab = computed(
  () => selectedTab.value?.id === ManagerTab.Workflow
)
const isAllTab = computed(() => selectedTab.value?.id === ManagerTab.All)

const isOutdatedPack = (pack: components['schemas']['Node']) => {
  const { isUpdateAvailable } = usePackUpdateStatus(pack)
  return isUpdateAvailable.value === true
}
const filterOutdatedPacks = (packs: components['schemas']['Node'][]) =>
  packs.filter(isOutdatedPack)

watch(
  [isUpdateAvailableTab, installedPacks],
  async () => {
    if (!isUpdateAvailableTab.value) return

    if (!isEmptySearch.value) {
      displayPacks.value = filterOutdatedPacks(installedPacks.value)
    } else if (
      !installedPacks.value.length &&
      !installedPacksReady.value &&
      !isLoadingInstalled.value
    ) {
      await startFetchInstalled()
    } else {
      displayPacks.value = filterOutdatedPacks(installedPacks.value)
    }
  },
  { immediate: true }
)

watch(
  [isInstalledTab, installedPacks],
  async () => {
    if (!isInstalledTab.value) return

    if (!isEmptySearch.value) {
      displayPacks.value = filterInstalledPack(searchResults.value)
    } else if (
      !installedPacks.value.length &&
      !installedPacksReady.value &&
      !isLoadingInstalled.value
    ) {
      await startFetchInstalled()
    } else {
      displayPacks.value = installedPacks.value
    }
  },
  { immediate: true }
)

watch(
  [isMissingTab, isWorkflowTab, workflowPacks, installedPacks],
  async () => {
    if (!isWorkflowTab.value && !isMissingTab.value) return

    if (!isEmptySearch.value) {
      displayPacks.value = isMissingTab.value
        ? filterMissingPacks(filterWorkflowPack(searchResults.value))
        : filterWorkflowPack(searchResults.value)
    } else if (
      !workflowPacks.value.length &&
      !isLoadingWorkflow.value &&
      !workflowPacksReady.value
    ) {
      await startFetchWorkflowPacks()
      if (isMissingTab.value) {
        await startFetchInstalled()
      }
    } else {
      displayPacks.value = isMissingTab.value
        ? filterMissingPacks(workflowPacks.value)
        : workflowPacks.value
    }
  },
  { immediate: true }
)

watch([isAllTab, searchResults], () => {
  if (!isAllTab.value) return
  displayPacks.value = searchResults.value
})

const onClickWarningLink = () => {
  window.open(
    'https://docs.comfy.org/troubleshooting/custom-node-issues',
    '_blank'
  )
}

const onResultsChange = () => {
  switch (selectedTab.value?.id) {
    case ManagerTab.Installed:
      displayPacks.value = isEmptySearch.value
        ? installedPacks.value
        : filterInstalledPack(searchResults.value)
      break
    case ManagerTab.Workflow:
      displayPacks.value = isEmptySearch.value
        ? workflowPacks.value
        : filterWorkflowPack(searchResults.value)
      break
    case ManagerTab.Missing:
      if (!isEmptySearch.value) {
        displayPacks.value = filterMissingPacks(
          filterWorkflowPack(searchResults.value)
        )
      }
      break
    case ManagerTab.UpdateAvailable:
      displayPacks.value = isEmptySearch.value
        ? filterOutdatedPacks(installedPacks.value)
        : filterOutdatedPacks(searchResults.value)
      break
    default:
      displayPacks.value = searchResults.value
  }
}

watch(searchResults, onResultsChange, { flush: 'post' })
watch(() => comfyManagerStore.installedPacksIds, onResultsChange)

const isLoading = computed(() => {
  if (isSearchLoading.value) return searchResults.value.length === 0
  if (selectedTab.value?.id === ManagerTab.Installed) {
    return isLoadingInstalled.value
  }
  if (
    selectedTab.value?.id === ManagerTab.Workflow ||
    selectedTab.value?.id === ManagerTab.Missing
  ) {
    return isLoadingWorkflow.value
  }
  return isInitialLoad.value
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

const getLoadingCount = () => {
  switch (selectedTab.value?.id) {
    case ManagerTab.Installed:
      return comfyManagerStore.installedPacksIds?.size
    case ManagerTab.Workflow:
      return workflowPacks.value?.length
    case ManagerTab.Missing:
      return workflowPacks.value?.filter?.(
        (pack) => !comfyManagerStore.isPackInstalled(pack.id)
      )?.length
    default:
      return searchResults.value.length
  }
}

const skeletonCardCount = computed(() => {
  const loadingCount = getLoadingCount()
  if (loadingCount) return loadingCount
  return isSmallScreen.value ? 12 : 16
})

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

// Track the last pack ID for which we've fetched full registry data
const lastFetchedPackId = ref<string | null>(null)

// Whenever a single pack is selected, fetch its full info once
whenever(selectedNodePack, async () => {
  // Cancel any in-flight requests from previously selected node pack
  getPackById.cancel()
  // If only a single node pack is selected, fetch full node pack info from registry
  const pack = selectedNodePack.value
  if (!pack?.id) return
  if (hasMultipleSelections.value) return
  // Only fetch if we haven't already for this pack
  if (lastFetchedPackId.value === pack.id) return
  const data = await getPackById.call(pack.id)
  // If selected node hasn't changed since request, merge registry & Algolia data
  if (data?.id === pack.id) {
    lastFetchedPackId.value = pack.id
    const mergedPack = merge({}, pack, data)
    // Update the pack in current selection without changing selection state
    const packIndex = selectedNodePacks.value.findIndex(
      (p) => p.id === mergedPack.id
    )
    if (packIndex !== -1) {
      selectedNodePacks.value.splice(packIndex, 1, mergedPack)
    }
    // Replace pack in displayPacks so that children receive a fresh prop reference
    const idx = displayPacks.value.findIndex((p) => p.id === mergedPack.id)
    if (idx !== -1) {
      displayPacks.value.splice(idx, 1, mergedPack)
    }
  }
})

let gridContainer: HTMLElement | null = null
onMounted(() => {
  gridContainer = document.getElementById('results-grid')
})
watch([searchQuery, selectedTab], () => {
  gridContainer ??= document.getElementById('results-grid')
  if (gridContainer) {
    pageNumber.value = 0
    gridContainer.scrollTop = 0
  }
})

watchEffect(() => {
  dismissRedDotNotification()
})

onBeforeUnmount(() => {
  persistedState.persistState({
    selectedTabId: selectedTab.value?.id,
    searchQuery: searchQuery.value,
    searchMode: searchMode.value,
    sortField: sortField.value
  })
})

onUnmounted(() => {
  getPackById.cancel()
})
</script>
