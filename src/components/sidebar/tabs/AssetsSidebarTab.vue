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
        v-model:media-type-filters="mediaTypeFilters"
        class="pb-1 px-2 2xl:px-4"
        :show-generation-time-sort="activeTab === 'output'"
      />
      <Divider type="dashed" class="my-2" />
    </template>
    <template #body>
      <div v-if="loading && !displayAssets.length">
        <ProgressSpinner class="absolute left-1/2 w-[50px] -translate-x-1/2" />
      </div>
      <div v-else-if="!loading && !displayAssets.length">
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
        <VirtualGrid
          :items="mediaAssetsWithKey"
          :grid-style="{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            padding: '0 0.5rem',
            gap: '0.5rem'
          }"
          @approach-end="handleApproachEnd"
        >
          <template #item="{ item }">
            <MediaAssetCard
              :asset="item"
              :selected="isSelected(item.id)"
              :show-output-count="shouldShowOutputCount(item)"
              :output-count="getOutputCount(item)"
              :show-delete-button="shouldShowDeleteButton"
              :open-context-menu-id="openContextMenuId"
              @click="handleAssetSelect(item)"
              @zoom="handleZoomClick(item)"
              @output-count-click="enterFolderView(item)"
              @asset-deleted="refreshAssets"
              @context-menu-opened="openContextMenuId = item.id"
            />
          </template>
        </VirtualGrid>
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
              size="lg"
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
</template>

<script setup lang="ts">
import { useDebounceFn, useElementHover, useResizeObserver } from '@vueuse/core'
import { Divider } from 'primevue'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Load3dViewerContent from '@/components/load3d/Load3dViewerContent.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import { useDialogStore } from '@/stores/dialogStore'
import { ResultItemImpl } from '@/stores/queueStore'
import { formatDuration, getMediaTypeFromFilename } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const activeTab = ref<'input' | 'output'>('output')
const folderPromptId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const isInFolderView = computed(() => folderPromptId.value !== null)

// Track which asset's context menu is open (for single-instance context menu management)
const openContextMenuId = ref<string | null>(null)

// Determine if delete button should be shown
// Hide delete button when in input tab and not in cloud (OSS mode - files are from local folders)
const shouldShowDeleteButton = computed(() => {
  if (activeTab.value === 'input' && !isCloud) return false
  return true
})

const getOutputCount = (item: AssetItem): number => {
  const count = item.user_metadata?.outputCount
  return typeof count === 'number' && count > 0 ? count : 1
}

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
  activate: activateSelection,
  deactivate: deactivateSelection
} = useAssetSelection()

const { downloadMultipleAssets, deleteMultipleAssets } = useMediaAssetActions()

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
  const selectedAssets = getSelectedAssets(displayAssets.value)
  return selectedAssets.reduce((sum, asset) => sum + getOutputCount(asset), 0)
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

watch(displayAssets, (newAssets) => {
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
  return displayAssets.value.map((asset) => {
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

// Add key property for VirtualGrid
const mediaAssetsWithKey = computed(() => {
  return displayAssets.value.map((asset) => ({
    ...asset,
    key: asset.id
  }))
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

const handleAssetSelect = (asset: AssetItem) => {
  const index = displayAssets.value.findIndex((a) => a.id === asset.id)
  handleAssetClick(asset, index, displayAssets.value)
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
  const index = displayAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}

const enterFolderView = (asset: AssetItem) => {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata) {
    console.warn('Invalid output asset metadata')
    return
  }

  const { promptId, allOutputs, executionTimeInSeconds } = metadata

  if (!promptId || !Array.isArray(allOutputs) || allOutputs.length === 0) {
    console.warn('Missing required folder view data')
    return
  }

  folderPromptId.value = promptId
  folderExecutionTime.value = executionTimeInSeconds

  folderAssets.value = allOutputs.map((output) => ({
    id: `${output.nodeId}-${output.filename}`,
    name: output.filename,
    size: 0,
    created_at: asset.created_at,
    tags: ['output'],
    preview_url: output.url,
    user_metadata: {
      promptId,
      nodeId: output.nodeId,
      subfolder: output.subfolder,
      executionTimeInSeconds,
      workflow: metadata.workflow
    }
  }))
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

const handleDownloadSelected = () => {
  const selectedAssets = getSelectedAssets(displayAssets.value)
  downloadMultipleAssets(selectedAssets)
  clearSelection()
}

const handleDeleteSelected = async () => {
  const selectedAssets = getSelectedAssets(displayAssets.value)
  await deleteMultipleAssets(selectedAssets)
  clearSelection()
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
