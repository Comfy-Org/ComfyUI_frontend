<template>
  <AssetsSidebarTemplate>
    <template #top>
      <span v-if="!isInFolderView" class="font-bold">
        {{ $t('sideToolbar.mediaAssets') }}
      </span>
      <div v-else class="flex w-full items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-bold">{{ $t('Job ID') }}:</span>
          <span class="text-sm">{{ folderPromptId?.substring(0, 8) }}</span>
          <button
            class="m-0 cursor-pointer border-0 bg-transparent p-0 outline-0"
            role="button"
            @click="copyJobId"
          >
            <i class="mb-1 icon-[lucide--copy] text-sm"></i>
          </button>
        </div>
        <div>
          <span>{{ formattedExecutionTime }}</span>
        </div>
      </div>
    </template>
    <template #header>
      <!-- Job Detail View Header -->
      <div v-if="isInFolderView" class="pt-4 pb-2">
        <IconTextButton
          :label="$t('sideToolbar.backToAssets')"
          type="secondary"
          @click="exitFolderView"
        >
          <template #icon>
            <i class="icon-[lucide--arrow-left] size-4" />
          </template>
        </IconTextButton>
      </div>
      <!-- Normal Tab View -->
      <TabList v-else v-model="activeTab" class="pt-4 pb-1">
        <Tab value="input">{{ $t('sideToolbar.labels.imported') }}</Tab>
        <Tab value="output">{{ $t('sideToolbar.labels.generated') }}</Tab>
      </TabList>
    </template>
    <template #body>
      <div v-if="displayAssets.length" class="relative size-full">
        <VirtualGrid
          v-if="displayAssets.length"
          :items="mediaAssetsWithKey"
          :grid-style="{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            padding: '0.5rem',
            gap: '0.5rem'
          }"
        >
          <template #item="{ item }">
            <MediaAssetCard
              :asset="item"
              :selected="isSelected(item.id)"
              :show-output-count="shouldShowOutputCount(item)"
              :output-count="getOutputCount(item)"
              :show-delete-button="!isInFolderView"
              @click="handleAssetSelect(item)"
              @zoom="handleZoomClick(item)"
              @output-count-click="enterFolderView(item)"
              @asset-deleted="refreshAssets"
            />
          </template>
        </VirtualGrid>
        <div v-else-if="loading">
          <ProgressSpinner
            class="absolute left-1/2 w-[50px] -translate-x-1/2"
          />
        </div>
        <div v-else>
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
      </div>
    </template>
    <template #footer>
      <div
        v-if="hasSelection && activeTab === 'output'"
        class="flex h-18 w-full items-center justify-between px-4"
      >
        <div>
          <TextButton
            v-if="isHoveringSelectionCount"
            :label="$t('mediaAsset.selection.deselectAll')"
            type="transparent"
            @click="handleDeselectAll"
            @mouseleave="isHoveringSelectionCount = false"
          />
          <span
            v-else
            role="button"
            tabindex="0"
            :aria-label="$t('mediaAsset.selection.deselectAll')"
            class="cursor-pointer px-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            @mouseenter="isHoveringSelectionCount = true"
            @keydown.enter="handleDeselectAll"
            @keydown.space.prevent="handleDeselectAll"
          >
            {{
              $t('mediaAsset.selection.selectedCount', { count: selectedCount })
            }}
          </span>
        </div>
        <div class="flex gap-2">
          <IconTextButton
            v-if="!isInFolderView"
            :label="$t('mediaAsset.selection.deleteSelected')"
            type="secondary"
            icon-position="right"
            @click="handleDeleteSelected"
          >
            <template #icon>
              <i class="icon-[lucide--trash-2] size-4" />
            </template>
          </IconTextButton>
          <IconTextButton
            :label="$t('mediaAsset.selection.downloadSelected')"
            type="secondary"
            icon-position="right"
            @click="handleDownloadSelected"
          >
            <template #icon>
              <i class="icon-[lucide--download] size-4" />
            </template>
          </IconTextButton>
        </div>
      </div>
    </template>
  </AssetsSidebarTemplate>
  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import TextButton from '@/components/button/TextButton.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import { t } from '@/i18n'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import { formatDuration, getMediaTypeFromFilename } from '@/utils/formatUtil'

import AssetsSidebarTemplate from './AssetSidebarTemplate.vue'

const activeTab = ref<'input' | 'output'>('input')
const folderPromptId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const isInFolderView = computed(() => folderPromptId.value !== null)

const getOutputCount = (item: AssetItem): number => {
  const count = item.user_metadata?.outputCount
  return typeof count === 'number' && count > 0 ? count : 0
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
  selectedCount,
  clearSelection,
  getSelectedAssets,
  activate: activateSelection,
  deactivate: deactivateSelection
} = useAssetSelection()

const { downloadMultipleAssets, deleteMultipleAssets } = useMediaAssetActions()

// Hover state for selection count
const isHoveringSelectionCount = ref(false)

const currentAssets = computed(() =>
  activeTab.value === 'input' ? inputAssets : outputAssets
)
const loading = computed(() => currentAssets.value.loading.value)
const error = computed(() => currentAssets.value.error.value)
const mediaAssets = computed(() => currentAssets.value.media.value)

const galleryActiveIndex = ref(-1)
const currentGalleryAssetId = ref<string | null>(null)

const folderAssets = ref<AssetItem[]>([])

const displayAssets = computed(() => {
  if (isInFolderView.value) {
    return folderAssets.value
  }
  return mediaAssets.value
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
    void refreshAssets()
  },
  { immediate: true }
)

const handleAssetSelect = (asset: AssetItem) => {
  const index = displayAssets.value.findIndex((a) => a.id === asset.id)
  handleAssetClick(asset, index, displayAssets.value)
}

const handleZoomClick = (asset: AssetItem) => {
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
  clearSelection()
}

onMounted(() => {
  activateSelection()
})

onUnmounted(() => {
  deactivateSelection()
})

const handleDeselectAll = () => {
  clearSelection()
  isHoveringSelectionCount.value = false
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
</script>
