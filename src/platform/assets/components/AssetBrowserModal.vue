<template>
  <BaseModalLayout
    data-component-id="AssetBrowserModal"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="displayTitle"
    @close="handleClose"
  >
    <template v-if="shouldShowLeftPanel" #leftPanel>
      <LeftSidePanel
        v-model="selectedCategory"
        data-component-id="AssetBrowserModal-LeftSidePanel"
        :nav-items="availableCategories"
      >
        <template #header-icon>
          <div class="icon-[lucide--folder] size-4" />
        </template>
        <template #header-title>
          <span class="capitalize">{{ displayTitle }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <SearchBox
        v-model="searchQuery"
        :autofocus="true"
        size="lg"
        :placeholder="$t('assetBrowser.searchAssetsPlaceholder')"
        class="max-w-96"
      />
    </template>

    <template #contentFilter>
      <AssetFilterBar
        :assets="categoryFilteredAssets"
        @filter-change="updateFilters"
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
import { computed, provide } from 'vue'

import SearchBox from '@/components/input/SearchBox.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import AssetFilterBar from '@/platform/assets/components/AssetFilterBar.vue'
import AssetGrid from '@/platform/assets/components/AssetGrid.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { OnCloseKey } from '@/types/widgetTypes'

const props = defineProps<{
  nodeType?: string
  inputName?: string
  onSelect?: (asset: AssetItem) => void
  onClose?: () => void
  showLeftPanel?: boolean
  assets?: AssetItem[]
  title?: string
}>()

const emit = defineEmits<{
  'asset-select': [asset: AssetDisplayItem]
  close: []
}>()

provide(OnCloseKey, props.onClose ?? (() => {}))

const {
  searchQuery,
  selectedCategory,
  availableCategories,
  contentTitle,
  categoryFilteredAssets,
  filteredAssets,
  updateFilters
} = useAssetBrowser(props.assets)

const displayTitle = computed(() => {
  return props.title ?? contentTitle.value
})

const shouldShowLeftPanel = computed(() => {
  return props.showLeftPanel ?? true
})

function handleClose() {
  props.onClose?.()
  emit('close')
}

function handleAssetSelectAndEmit(asset: AssetDisplayItem) {
  emit('asset-select', asset)
  // onSelect callback is provided by dialog composable layer
  // It handles the appropriate transformation (filename extraction or full asset)
  props.onSelect?.(asset)
}
</script>
