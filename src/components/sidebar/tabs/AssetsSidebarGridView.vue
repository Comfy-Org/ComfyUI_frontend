<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid
      class="flex-1"
      :items="assetItems"
      :grid-style="gridStyle"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <MediaAssetContextMenu
          :asset="item.asset"
          :asset-type="getAssetType(item.asset.tags)"
          :file-kind="getMediaTypeFromFilename(item.asset.name)"
          :show-delete-button
          :selected-assets
          :is-bulk-mode
          @zoom="emit('zoom', item.asset)"
          @asset-deleted="emit('asset-deleted')"
          @bulk-download="emit('bulk-download', $event)"
          @bulk-delete="emit('bulk-delete', $event)"
          @bulk-add-to-workflow="emit('bulk-add-to-workflow', $event)"
          @bulk-open-workflow="emit('bulk-open-workflow', $event)"
          @bulk-export-workflow="emit('bulk-export-workflow', $event)"
        >
          <MediaAssetCard
            :asset="item.asset"
            :selected="isSelected(item.asset.id)"
            :show-output-count="showOutputCount(item.asset)"
            :output-count="getOutputCount(item.asset)"
            :show-delete-button
            :selected-assets
            :is-bulk-mode
            @click="emit('select-asset', item.asset)"
            @zoom="emit('zoom', item.asset)"
            @asset-deleted="emit('asset-deleted')"
            @bulk-download="emit('bulk-download', $event)"
            @bulk-delete="emit('bulk-delete', $event)"
            @bulk-add-to-workflow="emit('bulk-add-to-workflow', $event)"
            @bulk-open-workflow="emit('bulk-open-workflow', $event)"
            @bulk-export-workflow="emit('bulk-export-workflow', $event)"
            @output-count-click="emit('output-count-click', item.asset)"
          />
        </MediaAssetContextMenu>
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const {
  assets,
  isSelected,
  showOutputCount,
  getOutputCount,
  showDeleteButton,
  selectedAssets,
  isBulkMode
} = defineProps<{
  assets: AssetItem[]
  isSelected: (assetId: string) => boolean
  showOutputCount: (asset: AssetItem) => boolean
  getOutputCount: (asset: AssetItem) => number
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'zoom', asset: AssetItem): void
  (e: 'asset-deleted'): void
  (e: 'bulk-download', assets: AssetItem[]): void
  (e: 'bulk-delete', assets: AssetItem[]): void
  (e: 'bulk-add-to-workflow', assets: AssetItem[]): void
  (e: 'bulk-open-workflow', assets: AssetItem[]): void
  (e: 'bulk-export-workflow', assets: AssetItem[]): void
  (e: 'output-count-click', asset: AssetItem): void
}>()

type AssetGridItem = { key: string; asset: AssetItem }

const assetItems = computed<AssetGridItem[]>(() =>
  assets.map((asset) => ({
    key: `asset-${asset.id}`,
    asset
  }))
)

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 30vw), 1fr))',
  padding: '0 0.5rem',
  gap: '0.5rem'
}
</script>
