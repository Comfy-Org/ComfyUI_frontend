<template>
  <ContextMenuRoot v-model:open="isContextMenuOpen">
    <ContextMenuTrigger as-child>
      <div
        ref="rowRef"
        class="group/tree-node flex w-full min-w-0 cursor-grab items-center gap-2 overflow-hidden rounded-sm py-1.5 pr-2 pl-8 outline-none select-none hover:bg-comfy-input"
        :data-asset-id="asset.id"
        role="listitem"
        tabindex="0"
        @dblclick="handleActivate"
        @keydown.enter.prevent="handleActivate"
      >
        <i
          class="icon-[comfy--ai-model] size-4 shrink-0 text-muted-foreground"
        />
        <span class="text-foreground min-w-0 flex-1 truncate text-sm">
          {{ displayName }}
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-9999 min-w-44 overflow-hidden rounded-md border border-border-default bg-comfy-menu-bg p-1 shadow-md"
      >
        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight"
          @select="handleActivate"
        >
          <i class="icon-[comfy--node] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.addToGraph') }}
        </ContextMenuItem>
        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight"
          @select="handleCopyFilename"
        >
          <i class="icon-[lucide--copy] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.copyFilename') }}
        </ContextMenuItem>
        <ContextMenuItem
          v-if="huggingFaceUrl"
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { formatRowDisplayName } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { useNodePreviewDragImage } from '@/components/sidebar/tabs/cloudModelLibrary/useNodePreviewDragImage'
import { usePragmaticDraggable } from '@/composables/usePragmaticDragAndDrop'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetDisplayName,
  getAssetFilename,
  getAssetModelType,
  getAssetSourceUrl
} from '@/platform/assets/utils/assetMetadataUtils'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

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

const rowRef = ref<HTMLElement | null>(null)
const isContextMenuOpen = ref(false)

watch(isContextMenuOpen, (open) => {
  if (open) emit('hoverChange', { asset: null })
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

const handleMouseEnter = () => {
  const rect = rowRef.value?.getBoundingClientRect()
  if (!rect) return
  emit('hoverChange', { asset, rect })
}
const handleMouseLeave = () => {
  emit('hoverChange', { asset: null })
}

const handleActivate = () => {
  emit('activate', asset)
}

const onGenerateDragPreview = useNodePreviewDragImage(() => {
  const category = getAssetModelType(asset)
  return category
    ? (useModelToNodeStore().getNodeProvider(category)?.nodeDef ?? null)
    : null
})

usePragmaticDraggable(() => rowRef.value, {
  getInitialData: () => ({ type: 'cloud-model-asset', asset }),
  onGenerateDragPreview,
  onDragStart: () => {
    emit('hoverChange', { asset: null })
  }
})

onMounted(() => {
  rowRef.value?.addEventListener('mouseenter', handleMouseEnter)
  rowRef.value?.addEventListener('mouseleave', handleMouseLeave)
})

onBeforeUnmount(() => {
  rowRef.value?.removeEventListener('mouseenter', handleMouseEnter)
  rowRef.value?.removeEventListener('mouseleave', handleMouseLeave)
  emit('hoverChange', { asset: null })
})
</script>
