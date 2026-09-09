<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid class="flex-1" :items="assets" :grid-style>
      <template #item="{ item }">
        <MediaAssetCard
          :asset="item"
          :selected="isSelected(item.id)"
          :show-output-count="showOutputCount(item)"
          :output-count="getOutputCount(item)"
          :show-native-video-controls="
            gridMode !== MEDIA_ASSET_GRID_MODE.gridSmall
          "
          @select="emit('select-asset', item)"
          @toggle-selection="emit('toggle-asset-selection', item)"
          @context-menu="emit('context-menu', $event, item)"
          @zoom="emit('zoom', item)"
          @output-count-click="emit('output-count-click', item)"
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
import type { PagedList } from '@/utils/pagedList'

const { assets, isSelected, showOutputCount, getOutputCount, gridMode } =
  defineProps<{
    assets: PagedList<AssetItem>
    isSelected: (assetId: string) => boolean
    showOutputCount: (asset: AssetItem) => boolean
    getOutputCount: (asset: AssetItem) => number
    gridMode: MediaAssetGridMode
  }>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'toggle-asset-selection', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'zoom', asset: AssetItem): void
  (e: 'output-count-click', asset: AssetItem): void
}>()

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: getMediaAssetGridColumns(gridMode),
  padding: '0 0.5rem',
  gap: '0.5rem'
}))
</script>
