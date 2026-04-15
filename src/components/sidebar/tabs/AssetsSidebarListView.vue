<template>
  <div class="flex h-full flex-col">
    <VirtualGrid
      ref="virtualGridRef"
      class="flex-1"
      :items="assetItems"
      :grid-style="listGridStyle"
      :max-columns="1"
      :default-item-height="48"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <div class="relative" :data-asset-id="item.asset.id">
          <LoadingOverlay
            :loading="assetsStore.isAssetDeleting(item.asset.id)"
            size="sm"
          >
            <i class="pi pi-trash text-xs" />
          </LoadingOverlay>
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
            @contextmenu.prevent.stop="emit('context-menu', $event, item.asset)"
            @click.stop="emit('select-asset', item.asset, selectableAssets)"
            @dblclick.stop="emit('preview-asset', item.asset)"
            @preview-click="emit('preview-asset', item.asset)"
            @stack-toggle="void toggleStack(item.asset)"
          >
            <template v-if="hoveredAssetId === item.asset.id" #actions>
              <Button
                variant="secondary"
                size="icon"
                :aria-label="t('mediaAsset.actions.moreOptions')"
                @click.stop="emit('context-menu', $event, item.asset)"
              >
                <i class="icon-[lucide--ellipsis] size-4" />
              </Button>
            </template>
          </AssetsListItem>
        </div>
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
import { useI18n } from 'vue-i18n'

import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import { useMarqueeSelection } from '@/composables/useMarqueeSelection'
import Button from '@/components/ui/button/Button.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { useAssetsStore } from '@/stores/assetsStore'
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
  toggleStack
} = defineProps<{
  assetItems: OutputStackListItem[]
  selectableAssets: AssetItem[]
  isSelected: (assetId: string) => boolean
  isStackExpanded: (asset: AssetItem) => boolean
  toggleStack: (asset: AssetItem) => Promise<void>
}>()

const assetsStore = useAssetsStore()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem, assets?: AssetItem[]): void
  (e: 'preview-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
}>()

const { t } = useI18n()
const hoveredAssetId = ref<string | null>(null)

const listGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0.5rem',
  gap: '0.625rem'
}

function getAssetPrimaryText(asset: AssetItem): string {
  return truncateFilename(getAssetDisplayName(asset))
}

function getAssetMediaType(asset: AssetItem) {
  return getMediaTypeFromFilename(asset.name)
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

function onAssetEnter(assetId: string) {
  hoveredAssetId.value = assetId
}

function onAssetLeave(assetId: string) {
  if (hoveredAssetId.value === assetId) {
    hoveredAssetId.value = null
  }
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
