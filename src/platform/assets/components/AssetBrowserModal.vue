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
          <div class="icon-[lucide--folder] size-4" />
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

    <template #contentFilter>
      <AssetFilterBar :assets="assets" @filter-change="updateFilters" />
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
  onSelect?: (assetPath: string) => void
  onClose?: () => void
  showLeftPanel?: boolean
  assets?: AssetItem[]
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
  filteredAssets,
  selectAssetWithCallback,
  updateFilters
} = useAssetBrowser(props.assets)

const shouldShowLeftPanel = computed(() => {
  return props.showLeftPanel ?? true
})

function handleClose() {
  props.onClose?.()
  emit('close')
}

async function handleAssetSelectAndEmit(asset: AssetDisplayItem) {
  emit('asset-select', asset)
  await selectAssetWithCallback(asset.id, props.onSelect)
}
</script>
