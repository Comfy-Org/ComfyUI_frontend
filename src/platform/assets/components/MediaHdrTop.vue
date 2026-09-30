<template>
  <div class="relative size-full overflow-hidden rounded-sm">
    <img
      v-if="asset.preview_id && asset.preview_url"
      :src="asset.preview_url"
      :alt="getAssetDisplayName(asset)"
      class="size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      :draggable="false"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 bg-modal-card-placeholder-background transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
    >
      <i class="icon-[lucide--sun] size-8 text-muted-foreground" />
      <span class="text-sm text-base-foreground">
        {{ $t('hdrViewer.hdrImage') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { getAssetDisplayName } from '../utils/assetMetadataUtils'

const { asset } = defineProps<{ asset: AssetMeta }>()
</script>
