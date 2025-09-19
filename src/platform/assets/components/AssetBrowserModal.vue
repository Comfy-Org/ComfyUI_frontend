<template>
  <BaseModalLayout
    data-component-id="AssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="contentTitle"
    @close="handleClose"
  >
    <template v-if="shouldShowLeftPanel" #leftPanel>
      <LeftSidePanel
        v-model="selectedCategory"
        data-component-id="AssetBrowserModal-LeftSidePanel"
        :nav-items="availableCategories"
      >
        <template #header-icon>
          <i-lucide:folder class="size-4" />
        </template>
        <template #header-title>{{ $t('assetBrowser.browseAssets') }}</template>
      </LeftSidePanel>
    </template>

    <template #header>
      <SearchBox
        v-model="searchQuery"
        size="lg"
        :placeholder="$t('assetBrowser.searchAssetsPlaceholder')"
        class="max-w-96"
      />
    </template>

    <template #content>
      <AssetGrid
        :assets="filteredAssets"
        @asset-select="handleAssetSelectAndEmit"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import SearchBox from '@/components/input/SearchBox.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import AssetGrid from '@/platform/assets/components/AssetGrid.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const props = defineProps<{
  nodeType?: string
  inputName?: string
  onSelect?: (assetPath: string) => void
  onClose?: () => void
  showLeftPanel?: boolean
  assets?: AssetItem[]
}>()

const emit = defineEmits<{
  'asset-select': [asset: AssetDisplayItem]
  close: []
}>()

// Use AssetBrowser composable for all business logic
const {
  searchQuery,
  selectedCategory,
  availableCategories,
  contentTitle,
  filteredAssets,
  selectAsset
} = useAssetBrowser(props.assets)

// Dialog controls panel visibility via prop
const shouldShowLeftPanel = computed(() => {
  return props.showLeftPanel ?? true
})

// Handle close button - call both the prop callback and emit the event
const handleClose = () => {
  props.onClose?.()
  emit('close')
}

// Handle asset selection and emit to parent
const handleAssetSelectAndEmit = (asset: AssetDisplayItem) => {
  selectAsset(asset) // This logs the selection for dev mode
  emit('asset-select', asset) // Emit the full asset object

  // Call prop callback if provided
  if (props.onSelect) {
    props.onSelect(asset.name) // Use asset name as the asset path
  }
}
</script>
