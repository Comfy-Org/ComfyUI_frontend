<template>
  <SidebarTabTemplate
    :title="isInFolderView ? '' : $t('sideToolbar.mediaAssets')"
  >
    <template v-if="isInFolderView" #tool-buttons>
      <div class="flex w-full items-center gap-2">
        <span class="font-medium"
          >Job ID: {{ folderPromptId?.substring(0, 8) }}</span
        >
        <button
          class="rounded p-1 transition-colors hover:bg-neutral-100 dark-theme:hover:bg-neutral-700"
          :title="$t('g.copy')"
          @click="copyJobId"
        >
          <i class="icon-[lucide--copy] size-4" />
        </button>
        <span class="ml-auto text-sm text-neutral-500">
          {{ formatExecutionTime(folderExecutionTime) }}
        </span>
      </div>
    </template>
    <template #header>
      <!-- Job Detail View Header -->
      <div
        v-if="isInFolderView"
        class="border-b border-neutral-300 px-4 pt-2 pb-3 dark-theme:border-neutral-700"
      >
        <button
          class="flex items-center gap-2 rounded bg-neutral-100 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-200 dark-theme:bg-neutral-700 dark-theme:hover:bg-neutral-600"
          @click="exitFolderView"
        >
          <i class="icon-[lucide--arrow-left] size-4" />
          <span>Back to all assets</span>
        </button>
      </div>
      <!-- Normal Tab View -->
      <Tabs v-model:value="activeTab" class="w-full">
        <TabList class="border-b border-neutral-300">
          <Tab value="input">{{ $t('sideToolbar.labels.imported') }}</Tab>
          <Tab value="output">{{ $t('sideToolbar.labels.generated') }}</Tab>
        </TabList>
      </Tabs>
    </template>
    <template #body>
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
            :selected="selectedAsset?.id === item.id"
            :show-output-count="
              activeTab === 'output' &&
              !isInFolderView &&
              (item.user_metadata?.outputCount as number) > 1
            "
            :output-count="(item.user_metadata?.outputCount as number) || 0"
            @click="handleAssetSelect(item)"
            @zoom="handleZoomClick(item)"
            @output-count-click="enterFolderView(item)"
          />
        </template>
      </VirtualGrid>
      <div v-else-if="loading">
        <ProgressSpinner class="absolute left-1/2 w-[50px] -translate-x-1/2" />
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
    </template>
  </SidebarTabTemplate>
  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { useMediaAssets } from '@/platform/assets/composables/useMediaAssets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const activeTab = ref<'input' | 'output'>('input')
const selectedAsset = ref<AssetItem | null>(null)
const folderPromptId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const isInFolderView = computed(() => folderPromptId.value !== null)

const toast = useToast()

const inputAssets = useMediaAssets('input')
const outputAssets = useMediaAssets('output')

const currentAssets = computed(() =>
  activeTab.value === 'input' ? inputAssets : outputAssets
)
const loading = computed(() => currentAssets.value.loading.value)
const error = computed(() => currentAssets.value.error.value)
const mediaAssets = computed(() => currentAssets.value.media.value)

const galleryActiveIndex = ref(-1)
const galleryItems = computed(() => {
  // Convert AssetItems to ResultItemImpl format for gallery
  // Use displayAssets instead of mediaAssets to show correct items based on view mode
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

// Group assets by promptId for output tab
const groupedAssets = computed(() => {
  if (activeTab.value !== 'output' || isInFolderView.value) {
    return null
  }

  const groups = new Map<string, AssetItem[]>()

  mediaAssets.value.forEach((asset) => {
    const promptId = asset.user_metadata?.promptId as string
    if (promptId) {
      if (!groups.has(promptId)) {
        groups.set(promptId, [])
      }
      groups.get(promptId)!.push(asset)
    }
  })

  return groups
})

// Get display assets based on view mode
const displayAssets = computed(() => {
  if (isInFolderView.value && folderPromptId.value) {
    // Show all assets from the selected prompt
    return mediaAssets.value.filter(
      (asset) => asset.user_metadata?.promptId === folderPromptId.value
    )
  }

  if (activeTab.value === 'output' && groupedAssets.value) {
    // Show only the first asset from each prompt group
    const firstAssets: AssetItem[] = []
    groupedAssets.value.forEach((assets) => {
      if (assets.length > 0) {
        // Add output count to the first asset
        const firstAsset = { ...assets[0] }
        firstAsset.user_metadata = {
          ...firstAsset.user_metadata,
          outputCount: assets.length
        }
        firstAssets.push(firstAsset)
      }
    })
    return firstAssets
  }

  return mediaAssets.value
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
    void refreshAssets()
  },
  { immediate: true }
)

const handleAssetSelect = (asset: AssetItem) => {
  // Toggle selection
  if (selectedAsset.value?.id === asset.id) {
    selectedAsset.value = null
  } else {
    selectedAsset.value = asset
  }
}

const handleZoomClick = (asset: AssetItem) => {
  // Find the index of the clicked asset
  const index = displayAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}

const enterFolderView = (asset: AssetItem) => {
  const promptId = asset.user_metadata?.promptId as string
  if (promptId) {
    folderPromptId.value = promptId
    // Get execution time from the first asset of this prompt
    const promptAssets = mediaAssets.value.filter(
      (a) => a.user_metadata?.promptId === promptId
    )
    if (promptAssets.length > 0) {
      folderExecutionTime.value = promptAssets[0].user_metadata
        ?.executionTimeInSeconds as number
    }
  }
}

const exitFolderView = () => {
  folderPromptId.value = null
  folderExecutionTime.value = undefined
}

const copyJobId = async () => {
  if (folderPromptId.value) {
    try {
      await navigator.clipboard.writeText(folderPromptId.value)
      toast.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'Job ID copied to clipboard',
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy Job ID',
        life: 3000
      })
    }
  }
}

const formatExecutionTime = (seconds?: number): string => {
  if (!seconds) return ''

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}
</script>
