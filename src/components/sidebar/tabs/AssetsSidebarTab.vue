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
  return mediaAssets.value.map((asset) => {
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
  return mediaAssets.value.map((asset) => ({
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
  const index = mediaAssets.value.findIndex((a) => a.id === asset.id)
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}
</script>
