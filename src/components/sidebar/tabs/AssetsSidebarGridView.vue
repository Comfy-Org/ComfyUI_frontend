<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid
      ref="virtualGridRef"
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
      <template #overlay>
        <div
          v-if="marqueeActive"
          class="pointer-events-none absolute z-50 border border-blue-400 bg-blue-500/20"
          :style="marqueeRectStyle"
        />
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import { useMarqueeSelection } from '@/composables/useMarqueeSelection'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const { assets, isSelected, showOutputCount, getOutputCount } = defineProps<{
  assets: AssetItem[]
  isSelected: (assetId: string) => boolean
  showOutputCount: (asset: AssetItem) => boolean
  getOutputCount: (asset: AssetItem) => number
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

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 30vw), 1fr))',
  padding: '0.5rem',
  gap: '0.625rem'
}

// Marquee drag-to-select
const virtualGridRef = ref<{ container: HTMLElement | null } | null>(null)
const gridContainer = computed(() => virtualGridRef.value?.container ?? null)

const { shiftKey, cmdOrCtrlKey } = useAssetSelection()
const selectionStore = useAssetSelectionStore()

const { isActive: marqueeActive, rectStyle: marqueeRectStyle } =
  useMarqueeSelection({
    container: gridContainer,
    shiftKey,
    cmdOrCtrlKey,
    getCurrentSelection: () => new Set(selectionStore.selectedAssetIds),
    onSelectionChange: (ids) => selectionStore.setSelection(ids)
  })
</script>
