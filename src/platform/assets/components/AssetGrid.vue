<template>
  <div
    data-component-id="AssetGrid"
    :class="
      cn('grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 p-2')
    "
    role="grid"
    :aria-label="$t('assetBrowser.assetCollection')"
    :aria-rowcount="-1"
    :aria-colcount="-1"
    :aria-setsize="assets.length"
  >
    <!-- Loading state -->
    <div
      v-if="loading"
      class="col-span-full flex items-center justify-center py-20"
    >
      <i
        class="icon-[lucide--loader] size-12 animate-spin text-muted-foreground"
      />
    </div>
    <!-- Empty state -->
    <div
      v-else-if="assets.length === 0"
      class="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <i class="mb-4 icon-[lucide--search] size-10" />
      <h3 class="mb-2 text-lg font-medium">
        {{ $t('assetBrowser.noAssetsFound') }}
      </h3>
      <p class="text-sm">{{ $t('assetBrowser.tryAdjustingFilters') }}</p>
    </div>
    <template v-else>
      <AssetCard
        v-for="asset in assets"
        :key="asset.id"
        :asset="asset"
        :interactive="true"
        @select="$emit('assetSelect', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import AssetCard from '@/platform/assets/components/AssetCard.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { cn } from '@/utils/tailwindUtil'

defineProps<{
  assets: AssetDisplayItem[]
  loading?: boolean
}>()

defineEmits<{
  assetSelect: [asset: AssetDisplayItem]
}>()
</script>
