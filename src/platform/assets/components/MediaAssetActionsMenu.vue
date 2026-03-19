<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          variant="secondary"
          size="icon"
          :aria-label="t('mediaAsset.actions.moreOptions')"
        >
          <i class="icon-[lucide--ellipsis] size-4" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side-offset="4"
        :collision-padding="8"
        class="z-50 bg-transparent p-0 shadow-lg"
      >
        <MediaAssetMenuPanel
          :asset
          :asset-type
          :file-kind
          :show-delete-button
          :selected-assets
          :is-bulk-mode
          @zoom="emit('zoom')"
          @asset-deleted="emit('asset-deleted')"
          @bulk-download="emit('bulk-download', $event)"
          @bulk-delete="emit('bulk-delete', $event)"
          @bulk-add-to-workflow="emit('bulk-add-to-workflow', $event)"
          @bulk-open-workflow="emit('bulk-open-workflow', $event)"
          @bulk-export-workflow="emit('bulk-export-workflow', $event)"
        />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'
import MediaAssetMenuPanel from './MediaAssetMenuPanel.vue'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
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

const { t } = useI18n()
</script>
