<template>
  <SidebarTabTemplate
    :title="isInFolderView ? '' : $t('sideToolbar.mediaAssets.title')"
  >
    <template #alt-title>
      <div
        v-if="isInFolderView"
        class="flex w-full items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2">
          <span class="font-bold">{{ $t('assetBrowser.jobId') }}:</span>
          <span class="text-sm">{{ folderPromptId?.substring(0, 8) }}</span>
          <button
            class="m-0 cursor-pointer border-0 bg-transparent p-0 outline-0"
            role="button"
            @click="copyJobId"
          >
            <i class="icon-[lucide--copy] text-sm"></i>
          </button>
        </div>
        <div>
          <span>{{ formattedExecutionTime }}</span>
        </div>
      </div>
    </template>
    <template #tool-buttons>
      <!-- Normal Tab View -->
      <TabList v-if="!isInFolderView" v-model="activeTab">
        <Tab class="font-inter" value="output">{{
          $t('sideToolbar.labels.generated')
        }}</Tab>
        <Tab class="font-inter" value="input">{{
          $t('sideToolbar.labels.imported')
        }}</Tab>
      </TabList>
    </template>
    <template #header>
      <!-- Job Detail View Header -->
      <div v-if="isInFolderView" class="px-2 2xl:px-4">
        <Button variant="secondary" size="lg" @click="exitFolderView">
          <i class="icon-[lucide--arrow-left] size-4" />
          <span>{{ $t('sideToolbar.backToAssets') }}</span>
        </Button>
      </div>

      <!-- Filter Bar -->
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:media-type-filters="mediaTypeFilters"
        class="pb-1 px-2 2xl:px-4"
        :show-generation-time-sort="activeTab === 'output'"
      />
      <div
        v-if="isQueuePanelV2Enabled"
        class="flex items-center justify-between px-2 py-2 2xl:px-4"
      >
        <span class="text-sm text-muted-foreground">
          {{ activeJobsLabel }}
        </span>
        <div class="flex items-center gap-2">
          <span class="text-sm text-base-foreground">
            {{ t('sideToolbar.queueProgressOverlay.clearQueueTooltip') }}
          </span>
          <Button
            variant="destructive"
            size="icon"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.clearQueueTooltip')
            "
            :disabled="queuedCount === 0"
            @click="handleClearQueue"
          >
            <i class="icon-[lucide--list-x] size-4" />
          </Button>
        </div>
      </div>
      <Divider v-else type="dashed" class="my-2" />
    </template>
    <template #body>
      <div v-if="showLoadingState">
        <ProgressSpinner class="absolute left-1/2 w-[50px] -translate-x-1/2" />
      </div>
      <div v-else-if="showEmptyState">
        <NoResultsPlaceholder
          icon="pi pi-info-circle"
          :title="
            $t(
              activeTab === 'input'
                ? 'sideToolbar.noImportedFiles'
                : 'sideToolbar.noGeneratedFiles'
            )
          "
          :message="$t('sideToolbar.noFilesFoundMessage')"
        />
      </div>
      <div v-else class="relative size-full" @click="handleEmptySpaceClick">
        <AssetsSidebarListView
          v-if="isListView"
          :asset-items="listViewAssetItems"
          :is-selected="isSelected"
          :selectable-assets="listViewSelectableAssets"
          :is-stack-expanded="isListViewStackExpanded"
          :toggle-stack="toggleListViewStack"
          :asset-type="activeTab"
          @select-asset="handleAssetSelect"
          @context-menu="handleAssetContextMenu"
          @approach-end="handleApproachEnd"
        />
        <AssetsSidebarGridView
          v-else
          :assets="displayAssets"
          :is-selected="isSelected"
          :asset-type="activeTab"
          :show-output-count="shouldShowOutputCount"
          :get-output-count="getOutputCount"
          @select-asset="handleAssetSelect"
          @context-menu="handleAssetContextMenu"
          @approach-end="handleApproachEnd"
          @zoom="handleZoomClick"
          @output-count-click="enterFolderView"
        />
      </div>
    </template>
    <template #footer>
      <div
        v-if="hasSelection"
        ref="footerRef"
        class="flex gap-1 h-18 w-full items-center justify-between"
      >
        <div class="flex-1 pl-4">
          <div ref="selectionCountButtonRef" class="inline-flex w-48">
            <Button
              variant="secondary"
              :class="cn(isCompact && 'text-left')"
              @click="handleDeselectAll"
            >
              {{
                isHoveringSelectionCount
                  ? $t('mediaAsset.selection.deselectAll')
                  : $t('mediaAsset.selection.selectedCount', {
                      count: totalOutputCount
                    })
              }}
            </Button>
          </div>
        </div>
        <div class="flex shrink gap-2 pr-4 items-center-safe justify-end-safe">
          <template v-if="isCompact">
            <!-- Compact mode: Icon only -->
            <Button
              v-if="shouldShowDeleteButton"
              size="icon"
              @click="handleDeleteSelected"
            >
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button size="icon" @click="handleDownloadSelected">
              <i class="icon-[lucide--download] size-4" />
            </Button>
          </template>
          <template v-else>
            <!-- Normal mode: Icon + Text -->
            <Button
              v-if="shouldShowDeleteButton"
              variant="secondary"
              @click="handleDeleteSelected"
            >
              <span>{{ $t('mediaAsset.selection.deleteSelected') }}</span>
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button variant="secondary" @click="handleDownloadSelected">
              <span>{{ $t('mediaAsset.selection.downloadSelected') }}</span>
              <i class="icon-[lucide--download] size-4" />
            </Button>
          </template>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
  <MediaAssetContextMenu
    v-if="contextMenuAsset"
    ref="contextMenuRef"
    :asset="contextMenuAsset"
    :asset-type="contextMenuAssetType"
    :file-kind="contextMenuFileKind"
    :show-delete-button="shouldShowDeleteButton"
    :selected-assets="selectedAssets"
    :is-bulk-mode="isBulkMode"
    @zoom="handleZoomClick(contextMenuAsset)"
    @hide="handleContextMenuHide"
    @asset-deleted="refreshAssets"
    @bulk-download="handleBulkDownload"
    @bulk-delete="handleBulkDelete"
    @bulk-add-to-workflow="handleBulkAddToWorkflow"
    @bulk-open-workflow="handleBulkOpenWorkflow"
    @bulk-export-workflow="handleBulkExportWorkflow"
  />
</template>

<script setup lang="ts">
import {
  useDebounceFn,
  useElementHover,
  useResizeObserver,
  useStorage
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import Load3dViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionStore } from '@/stores/executionStore'
import { ResultItemImpl, useQueueStore } from '@/stores/queueStore'
import { formatDuration, getMediaTypeFromFilename } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const { t, n } = useI18n()
const commandStore = useCommandStore()
const queueStore = useQueueStore()
const { activeJobsCount } = storeToRefs(queueStore)
const executionStore = useExecutionStore()
const settingStore = useSettingStore()

const activeTab = ref<'input' | 'output'>('output')
const folderPromptId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const isInFolderView = computed(() => folderPromptId.value !== null)
const viewMode = useStorage<'list' | 'grid'>(
  'Comfy.Assets.Sidebar.ViewMode',
  'grid'
)
const isQueuePanelV2Enabled = computed(() =>
  settingStore.get('Comfy.Queue.QPOV2')
)
const isListView = computed(
  () => isQueuePanelV2Enabled.value && viewMode.value === 'list'
)

const contextMenuRef = ref<InstanceType<typeof MediaAssetContextMenu>>()
const contextMenuAsset = ref<AssetItem | null>(null)

// Determine if delete button should be shown
// Hide delete button when in input tab and not in cloud (OSS mode - files are from local folders)
const shouldShowDeleteButton = computed(() => {
  if (activeTab.value === 'input' && !isCloud) return false
  return true
})

const contextMenuAssetType = computed(() =>
  contextMenuAsset.value ? getAssetType(contextMenuAsset.value.tags) : 'input'
)

const contextMenuFileKind = computed<MediaKind>(() =>
  getMediaTypeFromFilename(contextMenuAsset.value?.name ?? '')
)

const shouldShowOutputCount = (item: AssetItem): boolean => {
  if (activeTab.value !== 'output' || isInFolderView.value) {
    return false
  }
  return getOutputCount(item) > 1
}

const formattedExecutionTime = computed(() => {
  if (!folderExecutionTime.value) return ''
  return formatDuration(folderExecutionTime.value * 1000)
})

const queuedCount = computed(() => queueStore.pendingTasks.length)
const activeJobsLabel = computed(() => {
  const count = activeJobsCount.value
  return t(
    'sideToolbar.queueProgressOverlay.activeJobs',
    { count: n(count) },
    count
  )
})

const toast = useToast()

const inputAssets = useMediaAssets('input')
const outputAssets = useMediaAssets('output')

// Asset selection
const {
  isSelected,
  handleAssetClick,
  hasSelection,
  clearSelection,
  getSelectedAssets,
  reconcileSelection,
  getOutputCount,
  getTotalOutputCount,
  activate: activateSelection,
  deactivate: deactivateSelection
} = useAssetSelection()

const {
  downloadMultipleAssets,
  deleteAssets,
  addMultipleToWorkflow,
  openMultipleWorkflows,
  exportMultipleWorkflows
} = useMediaAssetActions()

// Footer responsive behavior
const footerRef = ref<HTMLElement | null>(null)
const footerWidth = ref(0)

// Track footer width changes
useResizeObserver(footerRef, (entries) => {
  const entry = entries[0]
  footerWidth.value = entry.contentRect.width
})

// Determine if we should show compact mode (icon only)
// Threshold matches when grid switches from 2 columns to 1 column
// 2 columns need about ~430px
const COMPACT_MODE_THRESHOLD_PX = 430
const isCompact = computed(
  () => footerWidth.value > 0 && footerWidth.value <= COMPACT_MODE_THRESHOLD_PX
)

// Hover state for selection count button
const selectionCountButtonRef = ref<HTMLElement | null>(null)
const isHoveringSelectionCount = useElementHover(selectionCountButtonRef)

// Total output count for all selected assets
const totalOutputCount = computed(() => {
  return getTotalOutputCount(selectedAssets.value)
})

const currentAssets = computed(() =>
  activeTab.value === 'input' ? inputAssets : outputAssets
)
const loading = computed(() => currentAssets.value.loading.value)
const error = computed(() => currentAssets.value.error.value)
const mediaAssets = computed(() => currentAssets.value.media.value)

const galleryActiveIndex = ref(-1)
const currentGalleryAssetId = ref<string | null>(null)

const folderAssets = ref<AssetItem[]>([])

// Base assets before search filtering
const baseAssets = computed(() => {
  if (isInFolderView.value) {
    return folderAssets.value
  }
  return mediaAssets.value
})

// Use media asset filtering composable
const { searchQuery, sortBy, mediaTypeFilters, filteredAssets } =
  useMediaAssetFiltering(baseAssets)

const displayAssets = computed(() => {
  return filteredAssets.value
})

const {
  assetItems: listViewAssetItems,
  selectableAssets: listViewSelectableAssets,
  isStackExpanded: isListViewStackExpanded,
  toggleStack: toggleListViewStack
} = useOutputStacks({
  assets: computed(() => displayAssets.value)
})

const visibleAssets = computed(() => {
  if (!isListView.value) return displayAssets.value
  return listViewSelectableAssets.value
})

const selectedAssets = computed(() => getSelectedAssets(visibleAssets.value))

const isBulkMode = computed(
  () => hasSelection.value && selectedAssets.value.length > 1
)

const showLoadingState = computed(
  () =>
    loading.value &&
    displayAssets.value.length === 0 &&
    activeJobsCount.value === 0
)

const showEmptyState = computed(
  () =>
    !loading.value &&
    displayAssets.value.length === 0 &&
    activeJobsCount.value === 0
)

watch(visibleAssets, (newAssets) => {
  // Alternative: keep hidden selections and surface them in UI; for now prune
  // so selection stays consistent with what this view can act on.
  reconcileSelection(newAssets)
  if (currentGalleryAssetId.value && galleryActiveIndex.value !== -1) {
    const newIndex = newAssets.findIndex(
      (asset) => asset.id === currentGalleryAssetId.value
    )
    if (newIndex !== -1) {
      galleryActiveIndex.value = newIndex
    }
  }
})

watch(galleryActiveIndex, (index) => {
  if (index === -1) {
    currentGalleryAssetId.value = null
  }
})

const galleryItems = computed(() => {
  return visibleAssets.value.map((asset) => {
    const mediaType = getMediaTypeFromFilename(asset.name)
    const resultItem = new ResultItemImpl({
      filename: asset.name,
      subfolder: '',
      type: 'output',
      nodeId: '0',
      mediaType: mediaType === 'image' ? 'images' : mediaType
    })

    Object.defineProperty(resultItem, 'url', {
      get() {
        return asset.preview_url || ''
      },
      configurable: true
    })

    return resultItem
  })
})

const refreshAssets = async () => {
  await currentAssets.value.fetchMediaList()
  if (error.value) {
    console.error('Failed to refresh assets:', error.value)
  }
}

watch(
  activeTab,
  () => {
    clearSelection()
    // Clear search when switching tabs
    searchQuery.value = ''
    // Reset pagination state when tab changes
    void refreshAssets()
  },
  { immediate: true }
)

const handleAssetSelect = (asset: AssetItem, assets?: AssetItem[]) => {
  const assetList = assets ?? visibleAssets.value
  const index = assetList.findIndex((a) => a.id === asset.id)
  handleAssetClick(asset, index, assetList)
}

function handleAssetContextMenu(event: MouseEvent, asset: AssetItem) {
  contextMenuAsset.value = asset
  void nextTick(() => {
    contextMenuRef.value?.show(event)
  })
}

function handleContextMenuHide() {
  // Delay clearing to allow command callbacks to emit before component unmounts
  requestAnimationFrame(() => {
    contextMenuAsset.value = null
  })
}

const handleBulkDownload = (assets: AssetItem[]) => {
  downloadMultipleAssets(assets)
  clearSelection()
}

const handleBulkDelete = async (assets: AssetItem[]) => {
  if (await deleteAssets(assets)) {
    clearSelection()
  }
}

const handleClearQueue = async () => {
  const pendingPromptIds = queueStore.pendingTasks
    .map((task) => task.promptId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  await commandStore.execute('Comfy.ClearPendingTasks')

  executionStore.clearInitializationByPromptIds(pendingPromptIds)
}

const handleBulkAddToWorkflow = async (assets: AssetItem[]) => {
  await addMultipleToWorkflow(assets)
  clearSelection()
}

const handleBulkOpenWorkflow = async (assets: AssetItem[]) => {
  await openMultipleWorkflows(assets)
  clearSelection()
}

const handleBulkExportWorkflow = async (assets: AssetItem[]) => {
  await exportMultipleWorkflows(assets)
  clearSelection()
}

const handleDownloadSelected = () => {
  downloadMultipleAssets(selectedAssets.value)
  clearSelection()
}

const handleDeleteSelected = async () => {
  if (await deleteAssets(selectedAssets.value)) {
    clearSelection()
  }
}

const handleZoomClick = (asset: AssetItem) => {
  const mediaType = getMediaTypeFromFilename(asset.name)

  if (mediaType === '3D') {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title: asset.name,
      component: Load3dViewerContent,
      props: {
        modelUrl: asset.preview_url || ''
      },
      dialogComponentProps: {
        style: 'width: 80vw; height: 80vh;',
        maximizable: true
      }
    })
    return
  }

  currentGalleryAssetId.value = asset.id
  const index = visibleAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}

const enterFolderView = async (asset: AssetItem) => {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata) {
    console.warn('Invalid output asset metadata')
    return
  }

  const { promptId, executionTimeInSeconds } = metadata

  if (!promptId) {
    console.warn('Missing required folder view data')
    return
  }

  folderPromptId.value = promptId
  folderExecutionTime.value = executionTimeInSeconds

  const folderItems = await resolveOutputAssetItems(metadata, {
    createdAt: asset.created_at
  })

  if (folderItems.length === 0) {
    console.warn('No outputs available for folder view')
    return
  }

  folderAssets.value = folderItems
}

const exitFolderView = () => {
  folderPromptId.value = null
  folderExecutionTime.value = undefined
  folderAssets.value = []
  searchQuery.value = ''
}

onMounted(() => {
  activateSelection()
})

onUnmounted(() => {
  deactivateSelection()
})

const handleDeselectAll = () => {
  clearSelection()
}

const handleEmptySpaceClick = () => {
  if (hasSelection) {
    clearSelection()
  }
}

const copyJobId = async () => {
  if (folderPromptId.value) {
    try {
      await navigator.clipboard.writeText(folderPromptId.value)
      toast.add({
        severity: 'success',
        summary: t('mediaAsset.jobIdToast.copied'),
        detail: t('mediaAsset.jobIdToast.jobIdCopied'),
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('mediaAsset.jobIdToast.error'),
        detail: t('mediaAsset.jobIdToast.jobIdCopyFailed'),
        life: 3000
      })
    }
  }
}

const handleApproachEnd = useDebounceFn(async () => {
  if (
    activeTab.value === 'output' &&
    !isInFolderView.value &&
    outputAssets.hasMore.value &&
    !outputAssets.isLoadingMore.value
  ) {
    await outputAssets.loadMore()
  }
}, 300)
</script>
