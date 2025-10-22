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
      <div v-if="isInFolderView" class="pt-4 pb-1">
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
        <ProgressSpinner
          style="width: 50px; left: 50%; transform: translateX(-50%)"
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
import { computed, onMounted, ref, watch } from 'vue'

import IconTextButton from '@/components/button/IconTextButton.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { useMediaAssets } from '@/platform/assets/composables/useMediaAssets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import {
  formatDuration,
  getMediaTypeFromFilenamePlural
} from '@/utils/formatUtil'

import AssetsSidebarTemplate from './AssetSidebarTemplate.vue'

const activeTab = ref<'input' | 'output'>('input')
const mediaAssets = ref<AssetItem[]>([])
const selectedAsset = ref<AssetItem | null>(null)
const folderPromptId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const isInFolderView = computed(() => folderPromptId.value !== null)

const formattedExecutionTime = computed(() => {
  if (!folderExecutionTime.value) return ''
  return formatDuration(folderExecutionTime.value * 1000)
})

const toast = useToast()

// Use unified media assets implementation that handles cloud/internal automatically
const { loading, error, fetchMediaList } = useMediaAssets()

const galleryActiveIndex = ref(-1)
const galleryItems = computed(() => {
  // Convert AssetItems to ResultItemImpl format for gallery
  // Use displayAssets instead of mediaAssets to show correct items based on view mode
  return displayAssets.value.map((asset) => {
    const resultItem = new ResultItemImpl({
      filename: asset.name,
      subfolder: '',
      type: 'output',
      nodeId: '0',
      mediaType: getMediaTypeFromFilenamePlural(asset.name)
    })

    // Override the url getter to use asset.preview_url
    Object.defineProperty(resultItem, 'url', {
      get() {
        return asset.preview_url || ''
      },
      configurable: true
    })

    return resultItem
  })
})

// Store folder view assets separately
const folderAssets = ref<AssetItem[]>([])

// Get display assets based on view mode
const displayAssets = computed(() => {
  if (isInFolderView.value) {
    // Show all assets from the folder view
    return folderAssets.value
  }

  // Normal view: show grouped assets (already have outputCount from API)
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
  const files = await fetchMediaList(activeTab.value)
  mediaAssets.value = files
  if (error.value) {
    console.error('Failed to refresh assets:', error.value)
  }
}

watch(activeTab, () => {
  void refreshAssets()
})

onMounted(() => {
  void refreshAssets()
})

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
  const allOutputs = asset.user_metadata?.allOutputs as any[]

  if (promptId && allOutputs) {
    folderPromptId.value = promptId
    folderExecutionTime.value = asset.user_metadata
      ?.executionTimeInSeconds as number

    // Convert all outputs to AssetItem format for folder view
    folderAssets.value = allOutputs.map((output) => ({
      id: `${promptId}-${output.nodeId}-${output.filename}`,
      name: output.filename,
      size: 0,
      created_at: asset.created_at, // Use parent asset's created_at
      tags: ['output'],
      preview_url: output.url,
      user_metadata: {
        promptId,
        nodeId: output.nodeId,
        subfolder: output.subfolder,
        executionTimeInSeconds: asset.user_metadata?.executionTimeInSeconds,
        workflow: asset.user_metadata?.workflow
      }
    }))
  }
}

const exitFolderView = () => {
  folderPromptId.value = null
  folderExecutionTime.value = undefined
  folderAssets.value = []
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
</script>
