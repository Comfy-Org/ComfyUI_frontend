<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    data-component-id="MediaAssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="$t('sideToolbar.mediaAssets.title')"
    :right-panel-title="$t('sideToolbar.mediaAssets.assetInfo')"
    content-padding="none"
    @close="onClose?.()"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--image-ai-edit] size-4" />
      <h2 class="flex-auto text-base font-semibold text-nowrap select-none">
        {{ $t('sideToolbar.mediaAssets.title') }}
      </h2>
    </template>
    <template #leftPanel>
      <LeftSidePanel v-model="activeNav" :nav-items />
    </template>

    <template #header>
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:filter-tags="filterTags"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:media-type-filters="mediaTypeFilters"
        :show-generation-time-sort="activeTab === 'output'"
        :suggestions="availableTags"
      />
    </template>

    <template v-if="isInFolderView" #contentFilter>
      <div class="flex items-center gap-2 px-6 py-2">
        <Button variant="secondary" size="sm" @click="exitFolderView">
          <i class="icon-[lucide--arrow-left] size-4" />
          {{ $t('sideToolbar.backToAssets') }}
        </Button>
        <span class="text-sm text-muted-foreground">
          {{ $t('assetBrowser.jobId') }}: {{ folderJobId?.substring(0, 8) }}
        </span>
      </div>
    </template>

    <template #content>
      <div
        v-if="loading && displayAssets.length === 0"
        class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 p-4"
      >
        <div
          v-for="n in 12"
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
      <NoResultsPlaceholder
        v-else-if="displayAssets.length === 0"
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
      <div v-else class="relative size-full">
        <AssetsSidebarListView
          v-if="viewMode === 'list'"
          :asset-items="listViewAssetItems"
          :is-selected="isSelected"
          :selectable-assets="listViewSelectableAssets"
          :is-stack-expanded="isListViewStackExpanded"
          :toggle-stack="toggleListViewStack"
          @select-asset="handleAssetSelect"
          @preview-asset="handleZoomClick"
          @context-menu="handleAssetContextMenu"
          @approach-end="handleApproachEnd"
        />
        <AssetsSidebarGridView
          v-else
          :assets="displayAssets"
          :is-selected="isSelected"
          :show-output-count="shouldShowOutputCount"
          :get-output-count="getOutputCount"
          @select-asset="handleAssetSelect"
          @context-menu="handleAssetContextMenu"
          @approach-end="handleApproachEnd"
          @zoom="handleZoomClick"
          @output-count-click="enterFolderView"
        />
        <!-- Selection action bar -->
        <div
          v-if="hasSelection"
          class="absolute inset-x-0 bottom-0 flex h-14 items-center justify-between gap-2 border-t border-comfy-input bg-base-background px-6"
        >
          <Button variant="secondary" @click="clearSelection">
            {{
              $t('mediaAsset.selection.selectedCount', {
                count: totalOutputCount
              })
            }}
          </Button>
          <div class="flex items-center gap-2">
            <Button
              v-if="shouldShowDeleteButton"
              variant="secondary"
              @click="handleDeleteSelected"
            >
              <i class="icon-[lucide--trash-2] size-4" />
              <span>{{ $t('mediaAsset.selection.deleteSelected') }}</span>
            </Button>
            <Button variant="secondary" @click="handleDownloadSelected">
              <i class="icon-[lucide--download] size-4" />
              <span>{{ $t('mediaAsset.selection.downloadSelected') }}</span>
            </Button>
          </div>
        </div>
      </div>
    </template>

    <template #rightPanel>
      <MediaAssetInfoPanel
        v-if="focusedAsset"
        :asset="focusedAsset"
        :assets="infoPanelAssets"
        :tag-suggestions="availableTags"
        @zoom="handleZoomClick"
      />
      <div
        v-else
        class="flex h-full items-center justify-center p-6 text-center text-muted"
      >
        {{ $t('sideToolbar.mediaAssets.selectAssetPrompt') }}
      </div>
    </template>
  </BaseModalLayout>
  <MediaLightbox
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
    @zoom="handleZoomClick(contextMenuAsset!)"
    @hide="contextMenuAsset = null"
    @asset-deleted="refreshAssets"
  />
</template>

<script setup lang="ts">
import { useAsyncState, useDebounceFn, useStorage } from '@vueuse/core'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import MediaAssetInfoPanel from '@/platform/assets/components/mediaInfo/MediaAssetInfoPanel.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useAvailableMediaTags } from '@/platform/assets/composables/useAvailableMediaTags'
import { getAssetAdditionalTags } from '@/platform/assets/utils/assetMetadataUtils'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { isCloud } from '@/platform/distribution/types'
import { ResultItemImpl } from '@/stores/queueStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import {
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'

const { t } = useI18n()

const { initialTab, onClose } = defineProps<{
  initialTab?: 'output' | 'input'
  onClose?: () => void
}>()

provide(OnCloseKey, onClose ?? (() => {}))

// Navigation: activeNav drives both the data source (tab) and tag filter
const activeNav = ref<string>(initialTab ?? 'output')

// Derive tab and tag filter from nav selection
// Format: "output" | "input" | "output:tag:landscape" | "input:tag:reference"
const activeTab = computed(() => {
  const nav = activeNav.value
  if (nav.startsWith('input')) return 'input'
  return 'output'
})

const navTagFilter = computed(() => {
  const match = activeNav.value.match(/^(?:output|input):tag:(.+)$/)
  return match ? match[1] : null
})

// Data layer — same providers used by the sidebar
const inputAssets = useMediaAssets('input')
const outputAssets = useMediaAssets('output')

const currentAssets = computed(() =>
  activeTab.value === 'input' ? inputAssets : outputAssets
)

// Per-category tag counts for nav tree
function getTagCounts(assets: AssetItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of assets) {
    for (const tag of getAssetAdditionalTags(a)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return counts
}

const outputTagCounts = computed(() => getTagCounts(outputAssets.media.value))
const inputTagCounts = computed(() => getTagCounts(inputAssets.media.value))

function tagNavItems(
  prefix: string,
  counts: Map<string, number>
): NavItemData[] {
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([tag, count]) => ({
      id: `${prefix}:tag:${tag}`,
      label: tag,
      icon: 'icon-[lucide--tag]',
      badge: count
    }))
}

const navItems = computed<(NavItemData | NavGroupData)[]>(() => {
  const items: (NavItemData | NavGroupData)[] = [
    {
      id: 'output',
      label: t('sideToolbar.labels.generated'),
      icon: 'icon-[lucide--image]'
    }
  ]

  const outputTags = tagNavItems('output', outputTagCounts.value)
  if (outputTags.length > 0) {
    items.push({
      title: t('sideToolbar.mediaAssets.infoPanel.tagging'),
      items: outputTags,
      collapsible: true
    })
  }

  items.push({
    id: 'input',
    label: t('sideToolbar.labels.imported'),
    icon: 'icon-[lucide--folder-input]'
  })

  const inputTags = tagNavItems('input', inputTagCounts.value)
  if (inputTags.length > 0) {
    items.push({
      title: t('sideToolbar.mediaAssets.infoPanel.tagging'),
      items: inputTags,
      collapsible: true
    })
  }

  return items
})
const loading = computed(() => currentAssets.value.loading.value)
const mediaAssets = computed(() => currentAssets.value.media.value)

// Folder view — drill into a job's outputs
const folderJobId = ref<string | null>(null)
const isInFolderView = computed(() => folderJobId.value !== null)

const { state: folderAssets, execute: loadFolderAssets } = useAsyncState(
  (metadata: OutputAssetMetadata, options: { createdAt?: string } = {}) =>
    resolveOutputAssetItems(metadata, options),
  [] as AssetItem[],
  { immediate: false, resetOnExecute: true }
)

const baseAssets = computed(() =>
  isInFolderView.value ? folderAssets.value : mediaAssets.value
)

const availableTags = useAvailableMediaTags(baseAssets)

// Filtering — reuses the same composable as the sidebar
const viewMode = useStorage<'list' | 'grid'>(
  'Comfy.Assets.Browser.ViewMode',
  'grid'
)

const { searchQuery, filterTags, sortBy, mediaTypeFilters, filteredAssets } =
  useMediaAssetFiltering(baseAssets)

const displayAssets = computed(() => filteredAssets.value)

// Output stacks for list view — same composable as the sidebar
const {
  assetItems: listViewAssetItems,
  selectableAssets: listViewSelectableAssets,
  isStackExpanded: isListViewStackExpanded,
  toggleStack: toggleListViewStack
} = useOutputStacks({
  assets: computed(() => displayAssets.value)
})

// Selection — same composable as the sidebar
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

const { downloadMultipleAssets, deleteAssets } = useMediaAssetActions()

const selectedAssets = computed(() => getSelectedAssets(displayAssets.value))

const totalOutputCount = computed(() =>
  getTotalOutputCount(selectedAssets.value)
)

watch(displayAssets, (assets) => reconcileSelection(assets))

onMounted(() => activateSelection())
onUnmounted(() => deactivateSelection())

// Folder view handlers
function shouldShowOutputCount(item: AssetItem): boolean {
  if (activeTab.value !== 'output' || isInFolderView.value) return false
  return getOutputCount(item) > 1
}

async function enterFolderView(asset: AssetItem) {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata?.jobId) return

  folderJobId.value = metadata.jobId
  await loadFolderAssets(0, metadata, { createdAt: asset.created_at })
}

function exitFolderView() {
  folderJobId.value = null
  searchQuery.value = ''
}

// Right panel
const isRightPanelOpen = ref(false)
const focusedAsset = ref<AssetItem | null>(null)
const expandedFocusedAssets = ref<AssetItem[]>([])

// When an image set is focused, resolve its sub-images for the info panel
watch(focusedAsset, async (asset) => {
  if (!asset) {
    expandedFocusedAssets.value = []
    return
  }
  const count = getOutputCount(asset)
  if (count > 1) {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (metadata) {
      expandedFocusedAssets.value = await resolveOutputAssetItems(metadata, {
        createdAt: asset.created_at
      })
      return
    }
  }
  expandedFocusedAssets.value = []
})

// Assets to pass to the info panel: expanded sub-images, multi-selection, or single
const infoPanelAssets = computed(() => {
  if (selectedAssets.value.length > 1) return selectedAssets.value
  if (expandedFocusedAssets.value.length > 1) return expandedFocusedAssets.value
  return undefined
})

const shouldShowDeleteButton = computed(() => {
  if (activeTab.value === 'input' && !isCloud) return false
  return true
})

function handleAssetSelect(asset: AssetItem) {
  focusedAsset.value = asset
  isRightPanelOpen.value = true
  const index = displayAssets.value.findIndex((a) => a.id === asset.id)
  handleAssetClick(asset, index, displayAssets.value)
}

function handleZoomClick(asset: AssetItem) {
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (!isPreviewableMediaType(mediaType)) return

  const index = previewableAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}

// Context menu — reuses the same component as the sidebar
const contextMenuRef = ref<InstanceType<typeof MediaAssetContextMenu>>()
const contextMenuAsset = ref<AssetItem | null>(null)

const contextMenuAssetType = computed(() =>
  contextMenuAsset.value ? getAssetType(contextMenuAsset.value.tags) : 'input'
)

const contextMenuFileKind = computed<MediaKind>(() =>
  getMediaTypeFromFilename(contextMenuAsset.value?.name ?? '')
)

function handleAssetContextMenu(event: MouseEvent, asset: AssetItem) {
  contextMenuAsset.value = asset
  void nextTick(() => contextMenuRef.value?.show(event))
}

// Gallery / lightbox — same pattern as the sidebar
const galleryActiveIndex = ref(-1)

const previewableAssets = computed(() =>
  displayAssets.value.filter((asset) =>
    isPreviewableMediaType(getMediaTypeFromFilename(asset.name))
  )
)

const galleryItems = computed(() =>
  previewableAssets.value.map((asset) => {
    const mediaType = getMediaTypeFromFilename(asset.name)
    const resultItem = new ResultItemImpl({
      filename: asset.name,
      subfolder: '',
      type: 'output',
      nodeId: '0',
      mediaType: mediaType === 'image' ? 'images' : mediaType
    })

    Object.defineProperty(resultItem, 'url', {
      get: () => asset.preview_url || '',
      configurable: true
    })

    return resultItem
  })
)

// Pagination — same pattern as the sidebar
const handleApproachEnd = useDebounceFn(async () => {
  if (
    activeTab.value === 'output' &&
    outputAssets.hasMore.value &&
    !outputAssets.isLoadingMore.value
  ) {
    await outputAssets.loadMore()
  }
}, 300)

// Sync nav selection → filter tags + data refresh
watch(
  activeNav,
  () => {
    searchQuery.value = ''
    filterTags.value = navTagFilter.value ? [navTagFilter.value] : []
    focusedAsset.value = null
    clearSelection()
    exitFolderView()
    void currentAssets.value.fetchMediaList()
  },
  { immediate: true }
)

async function refreshAssets() {
  await currentAssets.value.fetchMediaList()
}

function handleDownloadSelected() {
  downloadMultipleAssets(selectedAssets.value)
  clearSelection()
}

async function handleDeleteSelected() {
  if (await deleteAssets(selectedAssets.value)) {
    clearSelection()
  }
}
</script>
