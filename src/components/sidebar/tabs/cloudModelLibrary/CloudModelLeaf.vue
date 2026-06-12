<template>
  <ContextMenuRoot v-model:open="isContextMenuOpen">
    <ContextMenuTrigger as-child>
      <div
        ref="rowRef"
        :class="LEAF_ROW_CLASS"
        :data-asset-id="asset.id"
        role="listitem"
        tabindex="0"
        @dblclick="handleActivate"
        @keydown.enter.prevent="handleActivate"
      >
        <i
          :class="
            cn(
              hasLoader ? 'icon-[comfy--ai-model]' : 'icon-[lucide--file]',
              'size-4 shrink-0 text-muted-foreground'
            )
          "
        />
        <span class="text-foreground min-w-0 flex-1 truncate text-sm">
          {{ displayName }}
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="LEAF_MENU_CONTENT_CLASS">
        <ContextMenuItem
          v-if="hasLoader"
          :class="LEAF_MENU_ITEM_CLASS"
          @select="handleActivate"
        >
          <i class="icon-[comfy--node] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.addToGraph') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="LEAF_MENU_ITEM_CLASS"
          @select="handleCopyFilename"
        >
          <i class="icon-[lucide--copy] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.copyFilename') }}
        </ContextMenuItem>
        <ContextMenuItem
          v-if="huggingFaceUrl"
          :class="LEAF_MENU_ITEM_CLASS"
          @select="openHuggingFace"
        >
          <i class="icon-[lucide--external-link] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.openOnHuggingFace') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { formatRowDisplayName } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { useNodePreviewDragImage } from '@/components/sidebar/tabs/cloudModelLibrary/useNodePreviewDragImage'
import {
  LEAF_MENU_CONTENT_CLASS,
  LEAF_MENU_ITEM_CLASS,
  LEAF_ROW_CLASS,
  useModelLibraryLeaf
} from '@/composables/sidebarTabs/useModelLibraryLeaf'
import { usePragmaticDraggable } from '@/composables/usePragmaticDragAndDrop'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetDisplayName,
  getAssetFilename,
  getAssetModelType,
  getAssetSourceUrl
} from '@/platform/assets/utils/assetMetadataUtils'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { cn } from '@comfyorg/tailwind-utils'

const { asset } = defineProps<{
  asset: AssetItem
}>()
const emit = defineEmits<{
  activate: [asset: AssetItem]
  // Emitted on mouseenter/leave with the row's bounding rect. The parent owns
  // the single shared hover popover and uses the rect for positioning.
  hoverChange: [payload: { asset: AssetItem; rect: DOMRect } | { asset: null }]
}>()

const displayName = computed(() =>
  formatRowDisplayName(getAssetDisplayName(asset))
)

const hide = () => emit('hoverChange', { asset: null })
const { rowRef, isContextMenuOpen } = useModelLibraryLeaf({
  onShow: (rect) => emit('hoverChange', { asset, rect }),
  onHide: hide
})

const huggingFaceUrl = computed(() => {
  const url = getAssetSourceUrl(asset)
  return url && url.includes('huggingface.co') ? url : ''
})

const handleCopyFilename = async () => {
  await navigator.clipboard.writeText(getAssetFilename(asset))
}

const openHuggingFace = () => {
  if (!huggingFaceUrl.value) return
  window.open(huggingFaceUrl.value, '_blank', 'noopener,noreferrer')
}

// Whether any registered loader node can open this asset. Without one,
// drag-out and add-to-graph have nothing to create, so the affordances
// are withheld instead of failing silently.
const loaderNodeDef = computed(() => {
  const category = getAssetModelType(asset)
  return category
    ? (useModelToNodeStore().getNodeProvider(category)?.nodeDef ?? null)
    : null
})
const hasLoader = computed(() => loaderNodeDef.value !== null)

const handleActivate = () => {
  if (!hasLoader.value) return
  emit('activate', asset)
}

const onGenerateDragPreview = useNodePreviewDragImage(() => loaderNodeDef.value)

usePragmaticDraggable(() => rowRef.value, {
  getInitialData: () => ({ type: 'cloud-model-asset', asset }),
  canDrag: () => hasLoader.value,
  onGenerateDragPreview,
  onDragStart: hide
})
</script>
