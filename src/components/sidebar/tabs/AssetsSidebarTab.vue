<template>
  <SidebarTabTemplate
    ref="panelRef"
    :title="isInFolderView ? '' : $t('sideToolbar.mediaAssets.title')"
    :closable
    v-bind="$attrs"
  >
    <template #alt-title>
      <div
        v-if="isInFolderView"
        class="flex w-full items-center justify-between gap-2"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <Button
            v-tooltip.bottom="{
              value: $t('sideToolbar.backToAssets'),
              showDelay: 300
            }"
            variant="textonly"
            size="icon"
            type="button"
            class="shrink-0"
            :aria-label="$t('sideToolbar.backToAssets')"
            @click="exitFolderView"
          >
            <i class="icon-[lucide--arrow-left] size-4" />
          </Button>
          <span class="shrink-0 font-bold">
            {{ $t('assetBrowser.jobId') }}:
          </span>
          <span class="min-w-0 truncate text-sm">{{ folderJobId }}</span>
          <Button
            v-tooltip.bottom="{
              value: $t('g.copyJobId'),
              showDelay: 300
            }"
            variant="textonly"
            size="icon"
            type="button"
            class="shrink-0"
            :aria-label="$t('g.copyJobId')"
            @click="copyFolderJobId"
          >
            <i class="icon-[lucide--copy] size-4" />
          </Button>
        </div>
        <div class="shrink-0">
          <span>{{ formattedExecutionTime }}</span>
        </div>
      </div>
    </template>
    <template #header>
      <div v-if="!isInFolderView" class="overflow-x-auto px-4 pt-2 pb-px">
        <TabList v-model="activeTab">
          <Tab value="output">{{ $t('sideToolbar.labels.generated') }}</Tab>
          <Tab value="input">{{ $t('sideToolbar.labels.imported') }}</Tab>
        </TabList>
      </div>
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:date-filter="dateFilter"
        v-model:media-type-filters="mediaTypeFilters"
        :show-generation-time-sort="activeTab === 'output'"
      />
    </template>
    <template #body>
      <div v-bind="tabPanelAttrs" class="size-full">
        <div
          v-if="showLoadingState"
          class="grid gap-2 p-2"
          :style="skeletonGridStyle"
        >
          <div
            v-for="n in skeletonCount"
            :key="`skeleton-${n}`"
            class="flex flex-col gap-2 p-2"
          >
            <Skeleton class="aspect-square w-full rounded-lg" />
            <div class="flex flex-col gap-1">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </div>
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
        <div
          v-else
          class="relative size-full py-2"
          @click="handleEmptySpaceClick"
        >
          <AssetsSidebarListView
            v-if="isListView"
            :asset-items="listViewAssetItems"
            :is-selected="isSelected"
            :selectable-assets="listViewSelectableAssets"
            :is-stack-expanded="isListViewStackExpanded"
            :toggle-stack="toggleListViewStack"
            :on-load-more="loadMoreAssets"
            :can-load-more="canLoadMoreAssets"
            @select-asset="handleAssetSelect"
            @preview-asset="handleZoomClick"
            @context-menu="handleAssetContextMenu"
          />
          <div v-else class="size-full">
            <AssetsSidebarGridView
              :assets="displayAssets"
              :is-selected
              :show-output-count
              :get-output-count
              :grid-mode
              :on-load-more="loadMoreAssets"
              :can-load-more="canLoadMoreAssets"
              @select-asset="handleAssetSelect"
              @toggle-asset-selection="handleAssetSelectionToggle"
              @context-menu="handleAssetContextMenu"
              @zoom="handleZoomClick"
              @output-count-click="enterFolderView"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <MediaAssetSelectionBar
        v-if="hasSelection"
        :count="totalOutputCount"
        :show-delete="shouldShowDeleteButton"
        @deselect="handleDeselectAll"
        @download="handleBulkDownload(selectedAssets)"
        @delete="handleBulkDelete(selectedAssets)"
      />
    </template>
  </SidebarTabTemplate>
  <Teleport to="body">
    <div
      v-if="marqueeStyle"
      class="pointer-events-none fixed z-9999 border border-primary-background bg-primary-background/20"
      :style="marqueeStyle"
    />
  </Teleport>
  <MediaLightbox
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
  <ContextMenu
    :id="contextMenuId"
    ref="contextMenuRef"
    :model="contextMenuItems"
  />
</template>

<script setup lang="ts">
import { unrefElement, useAsyncState, useStorage } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/components/load3d/load3dViewerDialog'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useDismissableOverlay } from '@/composables/useDismissableOverlay'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import MediaAssetSelectionBar from '@/platform/assets/components/MediaAssetSelectionBar.vue'
import {
  getMediaAssetGridColumns,
  MEDIA_ASSET_VIEW_MODE
} from '@/platform/assets/components/mediaAssetViewOptions'
import type {
  MediaAssetGridMode,
  MediaAssetViewMode
} from '@/platform/assets/components/mediaAssetViewOptions'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useAssetGridSelection } from '@/platform/assets/composables/useAssetGridSelection'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import {
  getAssetFileUrl,
  getAssetSubfolder
} from '@/platform/assets/utils/assetUrlUtil'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { isCloud } from '@/platform/distribution/types'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  formatDuration,
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)

const { t } = useI18n()

const { closable = true } = defineProps<{ closable?: boolean }>()

const emit = defineEmits<{ assetSelected: [asset: AssetItem] }>()

const activeTab = ref<'input' | 'output'>('output')
const folderJobId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const expectedFolderCount = ref(0)
const isInFolderView = computed(() => folderJobId.value !== null)
const tabPanelAttrs = computed(() =>
  isInFolderView.value
    ? {}
    : {
        id: `tabpanel-${activeTab.value}`,
        role: 'tabpanel',
        tabindex: 0,
        'aria-labelledby': `tab-${activeTab.value}`
      }
)
const viewMode = useStorage<MediaAssetViewMode>(
  'Comfy.Assets.Sidebar.ViewMode',
  MEDIA_ASSET_VIEW_MODE.grid
)
const isListView = computed(() => viewMode.value === MEDIA_ASSET_VIEW_MODE.list)
const gridMode = computed<MediaAssetGridMode>(() =>
  viewMode.value === MEDIA_ASSET_VIEW_MODE.gridSmall
    ? MEDIA_ASSET_VIEW_MODE.gridSmall
    : MEDIA_ASSET_VIEW_MODE.grid
)
const skeletonGridStyle = computed(() => ({
  gridTemplateColumns: getMediaAssetGridColumns(gridMode.value)
}))

const contextMenuRef = useTemplateRef('contextMenuRef')
const contextMenuId = useId()
const contextMenuItems = ref<MenuItem[]>([])

useDismissableOverlay({
  isOpen: () => contextMenuRef.value?.visible ?? false,
  getOverlayEl: () => document.getElementById(contextMenuId),
  onDismiss: () => contextMenuRef.value?.hide(),
  dismissOnScroll: true
})

// Determine if delete button should be shown
// Hide delete button when in input tab and not in cloud (OSS mode - files are from local folders)
const shouldShowDeleteButton = computed(() => {
  if (activeTab.value === 'input' && !isCloud) return false
  return true
})

const showOutputCount = (item: AssetItem): boolean => {
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
const assetsStore = useAssetsStore()

// Asset selection
const {
  isSelected,
  selectedIds,
  handleAssetClick,
  toggleAssetSelection,
  selectAll,
  setSelectedIds,
  hasSelection,
  clearSelection,
  getSelectedAssets,
  reconcileSelection,
  getOutputCount,
  getTotalOutputCount,
  activate: activateSelection,
  deactivate: deactivateSelection
} = useAssetSelection()

const panelRef = useTemplateRef('panelRef')
const marqueePanelRef = computed(() => {
  const el = unrefElement(panelRef)
  return el instanceof HTMLElement ? el : undefined
})

const {
  downloadAssets,
  deleteAssets,
  addWorkflow,
  openWorkflow,
  exportWorkflow,
  copyJobId,
  addMultipleToWorkflow,
  openMultipleWorkflows,
  exportMultipleWorkflows
} = useMediaAssetActions()

const currentAssets = computed(() =>
  activeTab.value === 'input'
    ? assetsStore.inputAssets
    : assetsStore.outputAssets
)
const loading = computed(() => toValue(currentAssets.value.isLoading))
const mediaAssets = computed(() => toValue(currentAssets.value.items))

const galleryActiveIndex = ref(-1)
const currentGalleryAssetId = ref<string | null>(null)

const DEFAULT_SKELETON_COUNT = 6
const skeletonCount = computed(() =>
  expectedFolderCount.value > 0
    ? expectedFolderCount.value
    : DEFAULT_SKELETON_COUNT
)

const {
  state: folderAssets,
  isLoading: folderLoading,
  error: folderError,
  execute: loadFolderAssets
} = useAsyncState(
  (metadata: OutputAssetMetadata, options: { createdAt?: string } = {}) =>
    resolveOutputAssetItems(metadata, options),
  [] as AssetItem[],
  { immediate: false, resetOnExecute: true }
)

// Base assets before search filtering
const baseAssets = computed(() => {
  if (isInFolderView.value) {
    return folderAssets.value
  }
  return mediaAssets.value
})

// Use media asset filtering composable
const { searchQuery, sortBy, dateFilter, mediaTypeFilters, filteredAssets } =
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

const { marqueeStyle } = useAssetGridSelection({
  marqueeContainerRef: marqueePanelRef,
  hoverTargetRef: marqueePanelRef,
  getAssets: () => visibleAssets.value,
  getSelectedIds: () => [...selectedIds.value],
  setSelectedIds,
  selectAll,
  isEnabled: () => !isListView.value
})

const previewableVisibleAssets = computed(() =>
  visibleAssets.value.filter((asset) =>
    isPreviewableMediaType(getMediaTypeFromFilename(asset.name))
  )
)

const selectedAssets = computed(() => getSelectedAssets(visibleAssets.value))

const totalOutputCount = computed(() =>
  getTotalOutputCount(selectedAssets.value)
)

const isFolderLoading = computed(
  () => isInFolderView.value && folderLoading.value
)

const showLoadingState = computed(
  () =>
    (loading.value || isFolderLoading.value) && displayAssets.value.length === 0
)

const showEmptyState = computed(
  () =>
    !loading.value &&
    !isFolderLoading.value &&
    !canLoadMoreAssets.value &&
    displayAssets.value.length === 0
)

watch(visibleAssets, (newAssets) => {
  // Alternative: keep hidden selections and surface them in UI; for now prune
  // so selection stays consistent with what this view can act on.
  reconcileSelection(newAssets)
  if (currentGalleryAssetId.value && galleryActiveIndex.value !== -1) {
    const newIndex = previewableVisibleAssets.value.findIndex(
      (asset) => asset.id === currentGalleryAssetId.value
    )
    galleryActiveIndex.value = newIndex
  }
})

watch(galleryActiveIndex, (index) => {
  if (index === -1) {
    currentGalleryAssetId.value = null
  }
})

const galleryItems = computed<AugmentedResultItem[]>(() => {
  return previewableVisibleAssets.value.map((asset) => {
    const mediaType = getMediaTypeFromFilename(asset.name)
    return {
      filename: asset.name,
      subfolder: getAssetSubfolder(asset),
      type: 'output',
      nodeId: '0',
      mediaType: mediaType === 'image' ? 'images' : mediaType,
      url: asset.preview_url || ''
    }
  })
})

const refreshAssets = async () => {
  await currentAssets.value.invalidate()
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

function handleAssetSelect(asset: AssetItem, assets?: AssetItem[]) {
  const assetList = assets ?? visibleAssets.value
  const index = assetList.findIndex((a) => a.id === asset.id)
  emit('assetSelected', asset)
  handleAssetClick(asset, index, assetList)
}

function handleAssetSelectionToggle(asset: AssetItem) {
  const index = visibleAssets.value.findIndex((item) => item.id === asset.id)
  emit('assetSelected', asset)
  toggleAssetSelection(asset, index, visibleAssets.value)
}

function handleAssetContextMenu(event: MouseEvent, asset: AssetItem) {
  const assetType = getAssetType(asset.tags)
  const canDelete =
    shouldShowDeleteButton.value &&
    (assetType === 'output' || (assetType === 'input' && isCloud))
  const selection = selectedAssets.value
  const isBulk = selection.length > 1 && isSelected(asset.id)

  if (isBulk) {
    contextMenuItems.value = [
      {
        label: t('mediaAsset.selection.multipleSelectedAssets'),
        disabled: true
      },
      {
        label: t('mediaAsset.selection.insertAllAssetsAsNodes'),
        icon: 'icon-[comfy--node]',
        command: () => handleBulkAddToWorkflow(selection)
      },
      {
        label: t('mediaAsset.selection.openWorkflowAll'),
        icon: 'icon-[comfy--workflow]',
        command: () => handleBulkOpenWorkflow(selection)
      },
      {
        label: t('mediaAsset.selection.exportWorkflowAll'),
        icon: 'icon-[lucide--file-output]',
        command: () => handleBulkExportWorkflow(selection)
      },
      {
        label: t('mediaAsset.selection.downloadSelectedAll'),
        icon: 'icon-[lucide--download]',
        command: () => handleBulkDownload(selection)
      },
      {
        label: t('mediaAsset.selection.deleteSelectedAll'),
        icon: 'icon-[lucide--trash-2]',
        visible: canDelete,
        command: () => handleBulkDelete(selection)
      }
    ]
  } else {
    const hasWorkflow =
      assetType === 'output' ||
      (assetType === 'input' && supportsWorkflowMetadata(asset.name))
    const hasJobId = assetType !== 'input'
    contextMenuItems.value = [
      {
        label: t('mediaAsset.actions.inspect'),
        icon: 'icon-[lucide--zoom-in]',
        visible: isPreviewableMediaType(getMediaTypeFromFilename(asset.name)),
        command: () => handleZoomClick(asset)
      },
      {
        label: t('mediaAsset.actions.insertAsNodeInWorkflow'),
        icon: 'icon-[comfy--node]',
        visible: detectNodeTypeFromFilename(asset.name).nodeType !== null,
        command: () => addWorkflow(asset)
      },
      {
        label: t('mediaAsset.actions.download'),
        icon: 'icon-[lucide--download]',
        command: () => downloadAssets([asset])
      },
      { separator: true, visible: hasWorkflow },
      {
        label: t('mediaAsset.actions.openWorkflow'),
        icon: 'icon-[comfy--workflow]',
        visible: hasWorkflow,
        command: () => openWorkflow(asset)
      },
      {
        label: t('mediaAsset.actions.exportWorkflow'),
        icon: 'icon-[lucide--file-output]',
        visible: hasWorkflow,
        command: () => exportWorkflow(asset)
      },
      { separator: true, visible: hasJobId },
      {
        label: t('mediaAsset.actions.copyJobId'),
        icon: 'icon-[lucide--copy]',
        visible: hasJobId,
        command: () => copyJobId(asset)
      },
      { separator: true, visible: canDelete },
      {
        label: t('mediaAsset.actions.delete'),
        icon: 'icon-[lucide--trash-2]',
        visible: canDelete,
        command: async () => {
          if (await deleteAssets(asset)) await refreshAssets()
        }
      }
    ]
  }
  contextMenuRef.value?.show(event)
}

const handleBulkDownload = (assets: AssetItem[]) => {
  downloadAssets(assets)
  clearSelection()
}

const handleBulkDelete = async (assets: AssetItem[]) => {
  if (await deleteAssets(assets)) {
    clearSelection()
  }
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

const handleZoomClick = (asset: AssetItem) => {
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (!isPreviewableMediaType(mediaType)) {
    return
  }

  if (mediaType === '3D') {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title: getAssetDisplayName(asset),
      component: Load3dViewerContent,
      props: {
        modelUrl: getAssetFileUrl(asset)
      },
      dialogComponentProps: LOAD3D_VIEWER_DIALOG_PROPS
    })
    return
  }

  currentGalleryAssetId.value = asset.id
  const index = previewableVisibleAssets.value.findIndex(
    (a) => a.id === asset.id
  )
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

  const { jobId, executionTimeInSeconds } = metadata

  if (!jobId) {
    console.warn('Missing required folder view data')
    return
  }

  folderJobId.value = jobId
  folderExecutionTime.value = executionTimeInSeconds
  expectedFolderCount.value = metadata.outputCount ?? 0

  await loadFolderAssets(0, metadata, { createdAt: asset.created_at })

  if (folderError.value) {
    toast.add({
      severity: 'error',
      summary: t('sideToolbar.folderView.errorSummary'),
      detail: t('sideToolbar.folderView.errorDetail')
    })
    exitFolderView()
  }
}

const exitFolderView = () => {
  folderJobId.value = null
  folderExecutionTime.value = undefined
  expectedFolderCount.value = 0
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
  if (hasSelection.value) {
    clearSelection()
  }
}

const copyFolderJobId = async () => {
  if (folderJobId.value) {
    try {
      await navigator.clipboard.writeText(folderJobId.value)
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
        detail: t('mediaAsset.jobIdToast.jobIdCopyFailed')
      })
    }
  }
}

const loadMoreAssets = () => currentAssets.value.loadMore()
const canLoadMoreAssets = computed(
  () => !isInFolderView.value && toValue(currentAssets.value.hasMore)
)
</script>
