<template>
  <SidebarTabTemplate :title="$t('sideToolbar.mediaAssets')">
    <template #header>
      <Tabs v-model:value="activeTab" class="w-full">
        <TabList class="border-b border-neutral-300">
          <Tab value="input">{{ $t('sideToolbar.labels.imported') }}</Tab>
          <Tab value="output">{{ $t('sideToolbar.labels.generated') }}</Tab>
        </TabList>
      </Tabs>
    </template>
    <template #body>
      <VirtualGrid
        v-if="mediaAssets.length"
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
            @click="handleAssetSelect(item)"
            @zoom="handleZoomClick(item)"
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
import { computed, onMounted, ref, watch } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { useMediaAssets } from '@/platform/assets/composables/useMediaAssets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { ResultItemImpl } from '@/stores/queueStore'
import { getMediaTypeFromFilenamePlural } from '@/utils/formatUtil'

const activeTab = ref<'input' | 'output'>('input')
const mediaAssets = ref<AssetItem[]>([])
const selectedAsset = ref<AssetItem | null>(null)

// Use unified media assets implementation that handles cloud/internal automatically
const { loading, error, fetchMediaList } = useMediaAssets()

const galleryActiveIndex = ref(-1)
const galleryItems = computed(() => {
  // Convert AssetItems to ResultItemImpl format for gallery
  return mediaAssets.value.map((asset) => {
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

// Add key property for VirtualGrid
const mediaAssetsWithKey = computed(() => {
  return mediaAssets.value.map((asset) => ({
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
  const index = mediaAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}
</script>
