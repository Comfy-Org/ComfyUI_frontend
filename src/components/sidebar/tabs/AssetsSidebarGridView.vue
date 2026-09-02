<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid
      class="flex-1"
      :items="assetItems"
      :grid-style="gridStyle"
      :on-load-more
      :can-load-more
    >
      <template #item="{ item }">
        <MediaAssetCard
          :asset="item.asset"
          :selected="isSelected(item.asset.id)"
          :show-output-count="showOutputCount(item.asset)"
          :output-count="getOutputCount(item.asset)"
          :show-native-video-controls="
            gridMode !== MEDIA_ASSET_GRID_MODE.gridSmall
          "
          @select="emit('select-asset', item.asset)"
          @toggle-selection="emit('toggle-asset-selection', item.asset)"
          @context-menu="emit('context-menu', $event, item.asset)"
          @zoom="emit('zoom', item.asset)"
          @output-count-click="emit('output-count-click', item.asset)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import {
  getMediaAssetGridColumns,
  MEDIA_ASSET_GRID_MODE
} from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetGridMode } from '@/platform/assets/components/mediaAssetViewOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const { assets, isSelected, showOutputCount, getOutputCount, gridMode } =
  defineProps<{
    assets: AssetItem[]
    isSelected: (assetId: string) => boolean
    showOutputCount: (asset: AssetItem) => boolean
    getOutputCount: (asset: AssetItem) => number
    gridMode: MediaAssetGridMode
    onLoadMore?: () => unknown
    canLoadMore?: boolean
  }>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'toggle-asset-selection', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'zoom', asset: AssetItem): void
  (e: 'output-count-click', asset: AssetItem): void
}>()

type AssetGridItem = { key: string; asset: AssetItem }

const assetItems = computed<AssetGridItem[]>(() =>
  assets.map((asset) => ({
    key: `asset-${asset.id}`,
    asset
  }))
)

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: getMediaAssetGridColumns(gridMode),
  padding: '0 0.5rem',
  gap: '0.5rem'
}))
</script>
