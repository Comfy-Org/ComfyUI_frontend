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
      <LeftSidePanel v-model="activeTab" :nav-items />
    </template>

    <template #header>
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:media-type-filters="mediaTypeFilters"
        :show-generation-time-sort="activeTab === 'output'"
      />
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
      <div v-else class="size-full">
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
          :show-output-count="() => false"
          :get-output-count="() => 0"
          @select-asset="handleAssetSelect"
          @context-menu="handleAssetContextMenu"
          @approach-end="handleApproachEnd"
          @zoom="handleZoomClick"
        />
      </div>
    </template>

    <template #rightPanel>
      <MediaAssetInfoPanel
        v-if="focusedAsset"
        :asset="focusedAsset"
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
import { useDebounceFn, useStorage } from '@vueuse/core'
import { computed, nextTick, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import MediaAssetInfoPanel from '@/platform/assets/components/mediaInfo/MediaAssetInfoPanel.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { isCloud } from '@/platform/distribution/types'
import { ResultItemImpl } from '@/stores/queueStore'
import type { NavItemData } from '@/types/navTypes'
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

const activeTab = ref<string>(initialTab ?? 'output')

const navItems = computed<NavItemData[]>(() => [
  {
    id: 'output',
    label: t('sideToolbar.labels.generated'),
    icon: 'icon-[lucide--image]'
  },
  {
    id: 'input',
    label: t('sideToolbar.labels.imported'),
    icon: 'icon-[lucide--folder-input]'
  }
])

// Data layer — same providers used by the sidebar
const inputAssets = useMediaAssets('input')
const outputAssets = useMediaAssets('output')

const currentAssets = computed(() =>
  activeTab.value === 'input' ? inputAssets : outputAssets
)
const loading = computed(() => currentAssets.value.loading.value)
const mediaAssets = computed(() => currentAssets.value.media.value)

// Filtering — reuses the same composable as the sidebar
const viewMode = useStorage<'list' | 'grid'>(
  'Comfy.Assets.Browser.ViewMode',
  'grid'
)

const { searchQuery, sortBy, mediaTypeFilters, filteredAssets } =
  useMediaAssetFiltering(mediaAssets)

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
const { isSelected, handleAssetClick, reconcileSelection } = useAssetSelection()

watch(displayAssets, (assets) => reconcileSelection(assets))

// Right panel
const isRightPanelOpen = ref(false)
const focusedAsset = ref<AssetItem | null>(null)

const shouldShowDeleteButton = computed(() => {
  if (activeTab.value === 'input' && !isCloud) return false
  return true
})

function handleAssetSelect(asset: AssetItem) {
  focusedAsset.value = asset
  isRightPanelOpen.value = true
  handleAssetClick(asset, 0, displayAssets.value)
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

// Refresh on tab change — same pattern as the sidebar
watch(
  activeTab,
  () => {
    searchQuery.value = ''
    focusedAsset.value = null
    void currentAssets.value.fetchMediaList()
  },
  { immediate: true }
)

async function refreshAssets() {
  await currentAssets.value.fetchMediaList()
}
</script>
