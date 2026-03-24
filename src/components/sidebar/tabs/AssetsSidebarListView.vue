<template>
  <div class="flex h-full flex-col">
    <VirtualGrid
      class="flex-1"
      :items="assetItems"
      :grid-style="listGridStyle"
      :max-columns="1"
      :default-item-height="48"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <div class="relative">
          <LoadingOverlay
            :loading="assetsStore.isAssetDeleting(item.asset.id)"
            size="sm"
          >
            <i class="pi pi-trash text-xs" />
          </LoadingOverlay>
          <ContextMenu :modal="false">
            <ContextMenuTrigger as-child>
              <AssetsListItem
                role="button"
                tabindex="0"
                :aria-label="
                  t('assetBrowser.ariaLabel.assetCard', {
                    name: getAssetDisplayName(item.asset),
                    type: getAssetMediaType(item.asset)
                  })
                "
                :class="
                  cn(
                    getAssetCardClass(isSelected(item.asset.id)),
                    item.isChild && 'pl-6'
                  )
                "
                :preview-url="getAssetPreviewUrl(item.asset)"
                :preview-alt="getAssetDisplayName(item.asset)"
                :icon-name="iconForMediaType(getAssetMediaType(item.asset))"
                :is-video-preview="isVideoAsset(item.asset)"
                :primary-text="getAssetPrimaryText(item.asset)"
                :secondary-text="getAssetSecondaryText(item.asset)"
                :stack-count="getStackCount(item.asset)"
                :stack-indicator-label="t('mediaAsset.actions.seeMoreOutputs')"
                :stack-expanded="isStackExpanded(item.asset)"
                @mouseenter="onAssetEnter(item.asset.id)"
                @mouseleave="onAssetLeave(item.asset.id)"
                @click.stop="emit('select-asset', item.asset, selectableAssets)"
                @dblclick.stop="emit('preview-asset', item.asset)"
                @preview-click="emit('preview-asset', item.asset)"
                @stack-toggle="void toggleStack(item.asset)"
              >
                <template v-if="shouldShowActionsMenu(item.asset.id)" #actions>
                  <DropdownMenu
                    :open="openActionsAssetId === item.asset.id"
                    @update:open="
                      onActionsMenuOpenChange(item.asset.id, $event)
                    "
                  >
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="secondary"
                        size="icon"
                        :aria-label="t('mediaAsset.actions.moreOptions')"
                        @click.stop
                      >
                        <i class="icon-[lucide--ellipsis] size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      close-on-scroll
                      class="z-1700 bg-transparent p-0 shadow-lg"
                      :side-offset="4"
                      :collision-padding="8"
                    >
                      <MediaAssetMenuItems
                        :entries="getAssetMenuEntries(item.asset)"
                        surface="dropdown"
                        @action="void onAssetMenuAction($event)"
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </template>
              </AssetsListItem>
            </ContextMenuTrigger>
            <ContextMenuContent
              close-on-scroll
              class="z-1700 bg-transparent p-0 shadow-lg"
            >
              <MediaAssetMenuItems
                :entries="getAssetMenuEntries(item.asset)"
                surface="context"
                @action="void onAssetMenuAction($event)"
              />
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import ContextMenu from '@/components/ui/context-menu/ContextMenu.vue'
import ContextMenuContent from '@/components/ui/context-menu/ContextMenuContent.vue'
import ContextMenuTrigger from '@/components/ui/context-menu/ContextMenuTrigger.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useMediaAssetMenu } from '@/platform/assets/composables/useMediaAssetMenu'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import MediaAssetMenuItems from '@/platform/assets/components/MediaAssetMenuItems.vue'
import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import type { MenuActionEntry, MenuEntry } from '@/types/menuTypes'
import {
  formatDuration,
  formatSize,
  getMediaTypeFromFilename,
  truncateFilename
} from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  assetItems,
  selectableAssets,
  isSelected,
  isStackExpanded,
  toggleStack,
  showDeleteButton,
  selectedAssets,
  isBulkMode
} = defineProps<{
  assetItems: OutputStackListItem[]
  selectableAssets: AssetItem[]
  isSelected: (assetId: string) => boolean
  isStackExpanded: (asset: AssetItem) => boolean
  toggleStack: (asset: AssetItem) => Promise<void>
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
}>()

const assetsStore = useAssetsStore()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem, assets?: AssetItem[]): void
  (e: 'preview-asset', asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'asset-deleted'): void
  (e: 'bulk-download', assets: AssetItem[]): void
  (e: 'bulk-delete', assets: AssetItem[]): void
  (e: 'bulk-add-to-workflow', assets: AssetItem[]): void
  (e: 'bulk-open-workflow', assets: AssetItem[]): void
  (e: 'bulk-export-workflow', assets: AssetItem[]): void
}>()

const { t } = useI18n()
const hoveredAssetId = ref<string | null>(null)
const openActionsAssetId = ref<string | null>(null)
const { getMenuEntries } = useMediaAssetMenu({
  inspectAsset: (asset) => emit('preview-asset', asset),
  assetDeleted: () => emit('asset-deleted'),
  bulkDownload: (assets) => emit('bulk-download', assets),
  bulkDelete: (assets) => emit('bulk-delete', assets),
  bulkAddToWorkflow: (assets) => emit('bulk-add-to-workflow', assets),
  bulkOpenWorkflow: (assets) => emit('bulk-open-workflow', assets),
  bulkExportWorkflow: (assets) => emit('bulk-export-workflow', assets)
})

const listGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0 0.5rem',
  gap: '0.5rem'
}

function getAssetPrimaryText(asset: AssetItem): string {
  return truncateFilename(getAssetDisplayName(asset))
}

function getAssetMediaType(asset: AssetItem) {
  return getMediaTypeFromFilename(asset.name)
}

function getAssetMenuEntries(asset: AssetItem): MenuEntry[] {
  return getMenuEntries({
    asset,
    assetType: getAssetType(asset.tags),
    fileKind: getAssetMediaType(asset),
    showDeleteButton,
    selectedAssets,
    isBulkMode
  })
}

function isVideoAsset(asset: AssetItem): boolean {
  return getAssetMediaType(asset) === 'video'
}

function getAssetPreviewUrl(asset: AssetItem): string {
  const mediaType = getAssetMediaType(asset)
  if (mediaType === 'image' || mediaType === 'video') {
    return asset.preview_url || ''
  }
  return ''
}

function getAssetSecondaryText(asset: AssetItem): string {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.executionTimeInSeconds === 'number') {
    return `${metadata.executionTimeInSeconds.toFixed(2)}s`
  }

  const duration = asset.user_metadata?.duration
  if (typeof duration === 'number') {
    return formatDuration(duration)
  }

  if (typeof asset.size === 'number') {
    return formatSize(asset.size)
  }

  return ''
}

function getStackCount(asset: AssetItem): number | undefined {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.outputCount === 'number') {
    return metadata.outputCount
  }

  if (Array.isArray(metadata?.allOutputs)) {
    return metadata.allOutputs.length
  }

  return undefined
}

function getAssetCardClass(selected: boolean): string {
  return cn(
    'w-full text-text-primary transition-colors hover:bg-secondary-background-hover',
    'cursor-pointer',
    selected &&
      'bg-secondary-background-hover ring-1 ring-modal-card-border-highlighted ring-inset'
  )
}

function shouldShowActionsMenu(assetId: string): boolean {
  return (
    hoveredAssetId.value === assetId || openActionsAssetId.value === assetId
  )
}

function onActionsMenuOpenChange(assetId: string, isOpen: boolean): void {
  if (isOpen) {
    openActionsAssetId.value = assetId
    return
  }

  if (openActionsAssetId.value === assetId) {
    openActionsAssetId.value = null
  }
}

async function onAssetMenuAction(entry: MenuActionEntry) {
  await entry.onClick?.()
}

function onAssetEnter(assetId: string) {
  hoveredAssetId.value = assetId
}

function onAssetLeave(assetId: string) {
  if (hoveredAssetId.value === assetId) {
    hoveredAssetId.value = null
  }
}
</script>
