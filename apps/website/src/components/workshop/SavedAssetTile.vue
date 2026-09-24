<script setup lang="ts">
import { File as FileIcon, Loader2 } from '@lucide/vue'
import { computed } from 'vue'

import type { SavedAssetTile } from '../../lib/workshop/saved-assets'
import SavedAssetMedia from './SavedAssetMedia.vue'

const { tile, url } = defineProps<{
  tile: SavedAssetTile
  url?: string
}>()

const emit = defineEmits<{ mediaError: [] }>()

const media = computed(() =>
  tile.state === 'saved' && url && tile.kind !== 'audio'
    ? { kind: tile.kind, url, assetId: tile.assetId }
    : undefined
)
</script>

<template>
  <SavedAssetMedia
    v-if="media"
    :kind="media.kind"
    :url="media.url"
    :asset-id="media.assetId"
    class="size-full object-cover"
    data-testid="saved-asset-media"
    @media-error="emit('mediaError')"
  />
  <Loader2
    v-else-if="tile.state === 'pending'"
    class="size-5 text-primary-comfy-yellow motion-safe:animate-spin"
    aria-hidden="true"
  />
  <FileIcon v-else class="size-5" aria-hidden="true" />
</template>
