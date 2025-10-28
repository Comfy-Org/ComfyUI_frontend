<template>
  <div
    data-component-id="AssetGrid"
    :style="gridStyle"
    role="grid"
    aria-label="Asset collection"
    :aria-rowcount="-1"
    :aria-colcount="-1"
    :aria-setsize="assets.length"
  >
    <AssetCard
      v-for="asset in assets"
      :key="asset.id"
      :asset="asset"
      :interactive="true"
      role="gridcell"
      @select="$emit('assetSelect', $event)"
    />

    <!-- Empty state -->
    <div
      v-if="assets.length === 0"
      :class="
        cn(
          'col-span-full flex flex-col items-center justify-center py-16',
          'text-ash-300 dark-theme:text-ash-800'
        )
      "
    >
      <i class="mb-4 icon-[lucide--search] size-10" />
      <h3 class="mb-2 text-lg font-medium">
        {{ $t('assetBrowser.noAssetsFound') }}
      </h3>
      <p class="text-sm">{{ $t('assetBrowser.tryAdjustingFilters') }}</p>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="col-span-full flex items-center justify-center py-20"
    >
      <i
        class="icon-[lucide--loader]"
        :class="
          cn('size-12 animate-spin', 'text-ash-300 dark-theme:text-ash-800')
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AssetCard from '@/platform/assets/components/AssetCard.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { createGridStyle } from '@/utils/gridUtil'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  assets: AssetDisplayItem[]
  loading?: boolean
}>()

defineEmits<{
  assetSelect: [asset: AssetDisplayItem]
}>()

// Use same grid style as BaseModalLayout
const gridStyle = computed(() => createGridStyle())
</script>
