<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    :content-title="$t('manager.discoverCommunityContent')"
    class="manager-dialog"
  >
    <template #leftPanel>
      <LeftSidePanel
        v-model="selectedNavId"
        :nav-items="navItems"
      >
        <template #header-icon>
          <i class="icon-[lucide--puzzle]" />
        </template>
        <template #header-title>
          <span class="text-neutral text-base">{{ $t('manager.title') }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <div class="flex items-center gap-2">
        <SingleSelect
          v-model="searchMode"
          class="min-w-34"
          :options="filterOptions"
        />
        <AutoCompletePlus
          v-model.lazy="searchQuery"
          :suggestions="suggestions"
          :placeholder="$t('manager.searchPlaceholder')"
          :complete-on-focus="false"
          :delay="8"
          option-label="query"
          class="w-full max-w-lg min-w-md"
          :pt="{
            pcInputText: {
              root: {
                autofocus: true,
                class: 'w-full rounded-lg h-10'
              }
            },
            loader: { style: 'display: none' }
          }"
          :show-empty-message="false"
          @complete="stubTrue"
          @option-select="onOptionSelect"
        />
      </div>
    </template>

    <template #contentFilter>
      <!-- Conflict Warning Banner -->
      <div
        v-if="shouldShowManagerBanner"
        class="relative mx-6 mt-3 mb-4 flex items-center gap-6 rounded-lg bg-yellow-500/20 p-4"
      >
        <i
          class="icon-[lucide--triangle-alert] text-lg text-warning-background"
        />
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
        <Button
          class="absolute top-0 right-0"
          variant="textonly"
          size="icon"
          @click="dismissWarningBanner"
        >
          <i class="pi pi-times text-xs text-base-foreground" />
        </Button>
      </div>

      <!-- Filters Row -->
      <div class="relative flex flex-wrap justify-between gap-2 px-6 pb-4">
        <div>
          <PackInstallButton
            v-if="isMissingTab && missingNodePacks.length > 0"
            :disabled="isMissingLoading || !!missingError"
            :node-packs="missingNodePacks"
            size="lg"
            :label="$t('manager.installAllMissingNodes')"
          />
          <PackUpdateButton
            v-if="isUpdateAvailableTab && hasUpdateAvailable"
            :node-packs="enabledUpdateAvailableNodePacks"
            :has-disabled-update-packs="hasDisabledUpdatePacks"
            size="lg"
          />
        </div>

        <!-- Sort Options on right -->
        <div>
          <SingleSelect
            v-model="sortField"
            :label="$t('g.sort')"
            :options="availableSortOptions"
            class="w-48"
          >
            <template #icon>
              <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
            </template>
          </SingleSelect>
        </div>
      </div>
    </template>

    <template #content>
      <div
        v-if="isLoading"
        class="h-full scrollbar-hide w-full overflow-auto"
      >
        <GridSkeleton
          :grid-style="GRID_STYLE"
          :skeleton-card-count
        />
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
      <div
        v-else
        class="h-full"
        @click="handleGridContainerClick"
      >
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
              @click.stop="(event: MouseEvent) => selectNodePack(item, event)"
            />
          </template>
        </VirtualGrid>
      </div>
    </template>

    <template #rightPanel>
      <InfoPanel
        v-if="!hasMultipleSelections && selectedNodePack"
        :node-pack="selectedNodePack"
      />
      <InfoPanelMultiItem
        v-else
        :node-packs="selectedNodePacks"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { merge, stubTrue } from 'es-toolkit/compat'
import type { AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useExternalLink } from '@/composables/useExternalLink'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import type { NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import PackUpdateButton from '@/workbench/extensions/manager/components/manager/button/PackUpdateButton.vue'
import InfoPanel from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanel.vue'
import InfoPanelMultiItem from '@/workbench/extensions/manager/components/manager/infoPanel/InfoPanelMultiItem.vue'
import PackCard from '@/workbench/extensions/manager/components/manager/packCard/PackCard.vue'
import GridSkeleton from '@/workbench/extensions/manager/components/manager/skeleton/GridSkeleton.vue'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useUpdateAvailableNodes } from '@/workbench/extensions/manager/composables/nodePack/useUpdateAvailableNodes'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useManagerStatePersistence } from '@/workbench/extensions/manager/composables/useManagerStatePersistence'
import { useRegistrySearch } from '@/workbench/extensions/manager/composables/useRegistrySearch'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { initialTab, onClose } = defineProps<{
  initialTab?: ManagerTab
  onClose: () => void
}>()

provide(OnCloseKey, onClose)

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const comfyManagerStore = useComfyManagerStore()
const { getPackById } = useComfyRegistryStore()
const conflictAcknowledgment = useConflictAcknowledgment()
const persistedState = useManagerStatePersistence()
const initialState = persistedState.loadStoredState()

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))',
  gap: '1.5rem',
  padding: '0'
} as const

const {
  shouldShowManagerBanner,
  dismissWarningBanner,
  dismissRedDotNotification
} = conflictAcknowledgment

// Missing nodes composable
const {
  missingNodePacks,
  isLoading: isMissingLoading,
  error: missingError
} = useMissingNodes()

// Update available nodes composable
const {
  hasUpdateAvailable,
  enabledUpdateAvailableNodePacks,
  hasDisabledUpdatePacks
} = useUpdateAvailableNodes()

// Navigation items for LeftSidePanel
const navItems = computed<NavItemData[]>(() => [
  { id: ManagerTab.All, label: t('g.all'), icon: 'pi pi-list' },
  { id: ManagerTab.Installed, label: t('g.installed'), icon: 'pi pi-box' },
  {
    id: ManagerTab.Workflow,
    label: t('manager.inWorkflow'),
    icon: 'pi pi-folder'
  },
  {
    id: ManagerTab.Missing,
    label: t('g.missing'),
    icon: 'pi pi-exclamation-circle'
  },
  {
    id: ManagerTab.UpdateAvailable,
    label: t('g.updateAvailable'),
    icon: 'pi pi-sync'
  }
])

const initialTabId = initialTab ?? initialState.selectedTabId ?? ManagerTab.All
const selectedNavId = ref<string | null>(initialTabId)

const selectedTab = computed(() =>
  navItems.value.find((item) => item.id === selectedNavId.value)
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

// Filter and sort options for SingleSelect
const filterOptions = computed(() => [
  { name: t('manager.filter.nodePack'), value: 'packs' },
  { name: t('g.nodes'), value: 'nodes' }
])

const availableSortOptions = computed(() => {
  if (!sortOptions.value) return []
  return sortOptions.value.map((field) => ({
    name: field.label,
    value: field.id
  }))
})

const onOptionSelect = (event: AutoCompleteOptionSelectEvent) => {
  searchQuery.value = event.value.query
}

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
    buildDocsUrl('/troubleshooting/custom-node-issues', {
      includeLocale: true
    }),
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
const isRightPanelOpen = ref(false)

watch(
  () => selectedNodePacks.value.length,
  (length) => {
    isRightPanelOpen.value = length > 0
  }
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
  return 16
})

const selectNodePack = (
  nodePack: components['schemas']['Node'],
  event: MouseEvent
) => {
  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    const index = selectedNodePacks.value.findIndex(
      (pack) => pack.id === nodePack.id
    )

    if (index === -1) {
      selectedNodePacks.value = [...selectedNodePacks.value, nodePack]
    } else {
      selectedNodePacks.value = selectedNodePacks.value.filter(
        (pack) => pack.id !== nodePack.id
      )
    }
  } else {
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

const lastFetchedPackId = ref<string | null>(null)

whenever(selectedNodePack, async () => {
  getPackById.cancel()
  const pack = selectedNodePack.value
  if (!pack?.id) return
  if (hasMultipleSelections.value) return
  if (lastFetchedPackId.value === pack.id) return
  const data = await getPackById.call(pack.id)
  if (data?.id === pack.id) {
    lastFetchedPackId.value = pack.id
    const mergedPack = merge({}, pack, data)
    const packIndex = selectedNodePacks.value.findIndex(
      (p) => p.id === mergedPack.id
    )
    if (packIndex !== -1) {
      selectedNodePacks.value.splice(packIndex, 1, mergedPack)
    }
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
watch([searchQuery, selectedNavId], () => {
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
    selectedTabId: (selectedTab.value?.id as ManagerTab) ?? ManagerTab.All,
    searchQuery: searchQuery.value,
    searchMode: searchMode.value,
    sortField: sortField.value
  })
})

onUnmounted(() => {
  getPackById.cancel()
})
</script>
