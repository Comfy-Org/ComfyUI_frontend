<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :collision-padding="8"
        class="z-1700 bg-transparent p-0 shadow-lg"
      >
        <MediaAssetMenuPanel
          class="media-asset-context-menu-content"
          :asset
          :asset-type
          :file-kind
          :show-delete-button
          :selected-assets
          :is-bulk-mode
          close-on-scroll
          @zoom="emit('zoom')"
          @asset-deleted="emit('asset-deleted')"
          @bulk-download="emit('bulk-download', $event)"
          @bulk-delete="emit('bulk-delete', $event)"
          @bulk-add-to-workflow="emit('bulk-add-to-workflow', $event)"
          @bulk-open-workflow="emit('bulk-open-workflow', $event)"
          @bulk-export-workflow="emit('bulk-export-workflow', $event)"
        />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'
import MediaAssetMenuPanel from './MediaAssetMenuPanel.vue'

const {
  asset,
  assetType,
  fileKind,
  showDeleteButton,
  selectedAssets,
  isBulkMode
} = defineProps<{
  asset: AssetItem
  assetType: AssetContext['type']
  fileKind: MediaKind
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
}>()

const emit = defineEmits<{
  zoom: []
  'asset-deleted': []
  'bulk-download': [assets: AssetItem[]]
  'bulk-delete': [assets: AssetItem[]]
  'bulk-add-to-workflow': [assets: AssetItem[]]
  'bulk-open-workflow': [assets: AssetItem[]]
  'bulk-export-workflow': [assets: AssetItem[]]
}>()
</script>
