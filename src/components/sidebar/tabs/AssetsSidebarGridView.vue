<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <!-- key on gridMode remounts the virtualizer so it re-measures cell size
         when switching density (it caches item height/width otherwise). -->
    <VirtualGrid
      :key="gridMode"
      class="flex-1"
      :items="assetItems"
      :grid-style="gridStyle"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <MediaAssetCard
          :asset="item.asset"
          :selected="isSelected(item.asset.id)"
          :show-output-count="showOutputCount(item.asset)"
          :output-count="getOutputCount(item.asset)"
          @click="emit('select-asset', item.asset)"
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
import { gridColumnsForMode } from '@/platform/assets/components/mediaAssetViewOptions'
import type { MediaAssetViewMode } from '@/platform/assets/components/mediaAssetViewOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const {
  assets,
  isSelected,
  showOutputCount,
  getOutputCount,
  gridMode = 'grid-small'
} = defineProps<{
  assets: AssetItem[]
  isSelected: (assetId: string) => boolean
  showOutputCount: (asset: AssetItem) => boolean
  getOutputCount: (asset: AssetItem) => number
  gridMode?: MediaAssetViewMode
}>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
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
  gridTemplateColumns: gridColumnsForMode(gridMode),
  padding: '0 0.5rem',
  gap: '0.5rem'
}))
</script>
