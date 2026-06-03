<template>
  <ContextMenuRoot v-model:open="isContextMenuOpen">
    <ContextMenuTrigger as-child>
      <div
        ref="rowRef"
        :class="LEAF_ROW_CLASS"
        :data-node-name="nodeDef.name"
        role="listitem"
        tabindex="0"
        @dblclick="handleActivate"
        @keydown.enter.prevent="handleActivate"
      >
        <i
          :class="
            cn(
              'size-4 shrink-0',
              hasBrandIcon
                ? brandIconClass
                : 'icon-[lucide--cloud] text-muted-foreground'
            )
          "
        />
        <span class="text-foreground min-w-0 flex-1 truncate text-sm">
          {{ nodeDef.display_name }}
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="LEAF_MENU_CONTENT_CLASS">
        <ContextMenuItem :class="LEAF_MENU_ITEM_CLASS" @select="handleActivate">
          <i class="icon-[comfy--node] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.addToGraph') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="LEAF_MENU_ITEM_CLASS"
          @select="handleCopyNodeName"
        >
          <i class="icon-[lucide--copy] size-4" />
          {{ $t('cloudModelLibrary.contextMenu.copyNodeName') }}
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

import { formatPartnerProvider } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { useNodePreviewDragImage } from '@/components/sidebar/tabs/cloudModelLibrary/useNodePreviewDragImage'
import {
  LEAF_MENU_CONTENT_CLASS,
  LEAF_MENU_ITEM_CLASS,
  LEAF_ROW_CLASS,
  useModelLibraryLeaf
} from '@/composables/sidebarTabs/useModelLibraryLeaf'
import { usePragmaticDraggable } from '@/composables/usePragmaticDragAndDrop'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { getProviderIcon, hasProviderIcon } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const { nodeDef } = defineProps<{ nodeDef: ComfyNodeDefImpl }>()
const emit = defineEmits<{
  activate: [nodeDef: ComfyNodeDefImpl]
  // Mirrors CloudModelLeaf — parent owns the shared hover popover.
  hoverChange: [
    payload: { nodeDef: ComfyNodeDefImpl; rect: DOMRect } | { nodeDef: null }
  ]
}>()

const provider = computed(() => formatPartnerProvider(nodeDef.category))
const hasBrandIcon = computed(() => hasProviderIcon(provider.value))
const brandIconClass = computed(() => getProviderIcon(provider.value))

const hide = () => emit('hoverChange', { nodeDef: null })
const { rowRef, isContextMenuOpen } = useModelLibraryLeaf({
  onShow: (rect) => emit('hoverChange', { nodeDef, rect }),
  onHide: hide
})

const handleCopyNodeName = async () => {
  await navigator.clipboard.writeText(nodeDef.display_name || nodeDef.name)
}

const handleActivate = () => {
  emit('activate', nodeDef)
}

const onGenerateDragPreview = useNodePreviewDragImage(() => nodeDef)

usePragmaticDraggable(() => rowRef.value, {
  getInitialData: () => ({ type: 'partner-node', nodeDef }),
  onGenerateDragPreview,
  onDragStart: hide
})
</script>
