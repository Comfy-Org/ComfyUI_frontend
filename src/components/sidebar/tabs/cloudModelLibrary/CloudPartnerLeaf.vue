<template>
  <ContextMenuRoot v-model:open="isContextMenuOpen">
    <ContextMenuTrigger as-child>
      <div
        ref="rowRef"
        class="group/tree-node flex w-full min-w-0 cursor-grab items-center gap-2 overflow-hidden rounded-sm py-1.5 pr-2 pl-8 outline-none select-none hover:bg-comfy-input"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { formatPartnerProvider } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { useNodePreviewDragImage } from '@/components/sidebar/tabs/cloudModelLibrary/useNodePreviewDragImage'
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

const rowRef = ref<HTMLElement | null>(null)
const isContextMenuOpen = ref(false)

watch(isContextMenuOpen, (open) => {
  if (open) emit('hoverChange', { nodeDef: null })
})

const handleCopyNodeName = async () => {
  await navigator.clipboard.writeText(nodeDef.display_name || nodeDef.name)
}

const handleMouseEnter = () => {
  const rect = rowRef.value?.getBoundingClientRect()
  if (!rect) return
  emit('hoverChange', { nodeDef, rect })
}
const handleMouseLeave = () => {
  emit('hoverChange', { nodeDef: null })
}

const handleActivate = () => {
  emit('activate', nodeDef)
}

const onGenerateDragPreview = useNodePreviewDragImage(() => nodeDef)

usePragmaticDraggable(() => rowRef.value, {
  getInitialData: () => ({ type: 'partner-node', nodeDef }),
  onGenerateDragPreview,
  onDragStart: () => {
    emit('hoverChange', { nodeDef: null })
  }
})

onMounted(() => {
  rowRef.value?.addEventListener('mouseenter', handleMouseEnter)
  rowRef.value?.addEventListener('mouseleave', handleMouseLeave)
})

onBeforeUnmount(() => {
  rowRef.value?.removeEventListener('mouseenter', handleMouseEnter)
  rowRef.value?.removeEventListener('mouseleave', handleMouseLeave)
  emit('hoverChange', { nodeDef: null })
})
</script>
