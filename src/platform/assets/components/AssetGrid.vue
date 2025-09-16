<template>
  <div
    data-component-id="AssetGrid"
    class="grid grid-cols-2 md:grid-cols-4 gap-6 p-8"
    role="grid"
    aria-label="Asset collection"
    :aria-rowcount="-1"
    :aria-colcount="-1"
    :aria-setsize="assets.length"
  >
    <AssetCard
      v-for="(asset, index) in assets"
      :key="asset.id"
      :asset="asset"
      :interactive="true"
      role="gridcell"
      :aria-posinset="index + 1"
      @select="$emit('assetSelect', $event)"
    />

    <!-- Empty state -->
    <div
      v-if="assets.length === 0"
      :class="
        cn(
          'col-span-full flex flex-col items-center justify-center py-16',
          'text-stone-300',
          'dark-theme:text-stone-200'
        )
      "
    >
      <i class="pi pi-search text-4xl mb-4"></i>
      <h3 class="text-lg font-medium mb-2">
        {{ $t('assetBrowser.noAssetsFound') }}
      </h3>
      <p class="text-sm">{{ $t('assetBrowser.tryAdjustingFilters') }}</p>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="col-span-full flex items-center justify-center py-16"
    >
      <i
        :class="
          cn(
            'pi pi-spinner pi-spin text-2xl',
            'text-stone-300',
            'dark-theme:text-stone-200'
          )
        "
      ></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { cn } from '@/utils/tailwindUtil'

import AssetCard from './AssetCard.vue'

defineProps<{
  assets: AssetDisplayItem[]
  loading?: boolean
}>()

defineEmits<{
  assetSelect: [asset: AssetDisplayItem]
}>()
</script>
