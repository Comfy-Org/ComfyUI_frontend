<template>
  <div
    data-component-id="AssetGrid"
    class="h-full"
    role="grid"
    :aria-label="$t('assetBrowser.assetCollection')"
    :aria-rowcount="-1"
    :aria-colcount="-1"
    :aria-setsize="assets.length"
  >
    <div v-if="loading" class="flex h-full items-center justify-center py-20">
      <i
        class="icon-[lucide--loader] size-12 animate-spin text-muted-foreground"
      />
    </div>
    <div
      v-else-if="assets.length === 0"
      class="flex h-full flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <i class="mb-4 icon-[lucide--search] size-10" />
      <h3 class="mb-2 text-lg font-medium">
        {{ $t('assetBrowser.noAssetsFound') }}
      </h3>
      <p class="text-sm">{{ $t('assetBrowser.tryAdjustingFilters') }}</p>
    </div>
    <VirtualGrid
      v-else
      :items="assetsWithKey"
      :grid-style="gridStyle"
      :default-item-height="320"
      :default-item-width="240"
    >
      <template #item="{ item }">
        <AssetCard
          :asset="item"
          :interactive="true"
          @select="$emit('assetSelect', $event)"
          @deleted="$emit('assetDeleted', $event)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import AssetCard from '@/platform/assets/components/AssetCard.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'

const { assets } = defineProps<{
  assets: AssetDisplayItem[]
  loading?: boolean
}>()

defineEmits<{
  assetSelect: [asset: AssetDisplayItem]
  assetDeleted: [asset: AssetDisplayItem]
}>()

const assetsWithKey = computed(() =>
  assets.map((asset) => ({ ...asset, key: asset.id }))
)

const gridStyle: Partial<CSSProperties> = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))',
  gap: '1rem',
  padding: '0.5rem'
}
</script>
