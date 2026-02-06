<template>
  <TreeItem
    v-slot="{ isExpanded, isSelected, handleToggle, handleSelect }"
    :value="item.value"
    :level="item.level"
    as-child
  >
    <!-- Node with context menu -->
    <ContextMenuTrigger
      v-if="showContextMenu && item.value.type === 'node'"
      as-child
    >
      <div
        class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
        :class="{ 'bg-highlight': isSelected }"
        :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
        @click.stop="handleClick($event, handleToggle, handleSelect)"
        @contextmenu="handleContextMenu"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <i class="icon-[comfy--node] size-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate text-sm text-foreground">
          <slot name="node" :node="item.value">
            {{ item.value.label }}
          </slot>
        </span>
      </div>
    </ContextMenuTrigger>

    <!-- Node without context menu -->
    <div
      v-else-if="item.value.type === 'node'"
      class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
      :class="{ 'bg-highlight': isSelected }"
      :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <i class="icon-[comfy--node] size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate text-sm text-foreground">
        <slot name="node" :node="item.value">
          {{ item.value.label }}
        </slot>
      </span>
    </div>

    <!-- Folder -->
    <div
      v-else
      class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
      :class="{ 'bg-highlight': isSelected }"
      :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
    >
      <i
        :class="cn(item.value.icon, 'size-4 shrink-0 text-muted-foreground')"
      />
      <span class="min-w-0 flex-1 truncate text-sm text-foreground">
        <slot name="folder" :node="item.value">
          {{ item.value.label }}
        </slot>
      </span>
      <i
        v-if="item.hasChildren"
        :class="
          cn(
            'icon-[lucide--chevron-down] mr-4 size-4 shrink-0 text-muted-foreground transition-transform',
            !isExpanded && '-rotate-90'
          )
        "
      />
    </div>
  </TreeItem>

  <Teleport
    v-if="isHovered && item.value.type === 'node' && item.value.data"
    to="#node-library-node-preview-container-v2"
  >
    <div ref="previewRef" :style="nodePreviewStyle">
      <NodePreviewCard :node-def="item.value.data" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import { ContextMenuTrigger, TreeItem } from 'reka-ui'
import type { CSSProperties } from 'vue'
import { computed, inject, ref } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const { item, showContextMenu = false } = defineProps<{
  item: FlattenedItem<RenderedTreeExplorerNode>
  showContextMenu?: boolean
}>()

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode, event: MouseEvent]
}>()

const contextMenuNode = inject(InjectKeyContextMenuNode)
const settingStore = useSettingStore()

const isHovered = ref(false)
const previewRef = ref<HTMLElement>()
const nodePreviewStyle = ref<CSSProperties>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  pointerEvents: 'none',
  zIndex: 1001
})

const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

function handleClick(
  e: MouseEvent,
  handleToggle: () => void,
  handleSelect: () => void
) {
  handleSelect()
  if (item.value.type === 'folder') {
    handleToggle()
  }
  emit('nodeClick', item.value, e)
}

function handleContextMenu() {
  if (contextMenuNode) {
    contextMenuNode.value = item.value
  }
}

const PREVIEW_WIDTH = 176
const PREVIEW_MARGIN = 16

function handleMouseEnter(e: MouseEvent) {
  if (item.value.type !== 'node') return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  // Calculate horizontal position based on sidebar location
  let left: number
  if (sidebarLocation.value === 'left') {
    left = rect.right + PREVIEW_MARGIN
    // If preview would overflow right edge, flip to left side
    if (left + PREVIEW_WIDTH > viewportWidth) {
      left = rect.left - PREVIEW_MARGIN - PREVIEW_WIDTH
    }
  } else {
    left = rect.left - PREVIEW_MARGIN - PREVIEW_WIDTH
    // If preview would overflow left edge, flip to right side
    if (left < 0) {
      left = rect.right + PREVIEW_MARGIN
    }
  }

  // Calculate mouse Y position (center of hovered item)
  const mouseY = rect.top + rect.height / 2

  // Initial top position - will be adjusted after render
  let top = rect.top

  nodePreviewStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    pointerEvents: 'none',
    zIndex: 1001
  }
  isHovered.value = true

  // After render, adjust position to ensure mouse is within preview height
  requestAnimationFrame(() => {
    if (previewRef.value) {
      const previewRect = previewRef.value.getBoundingClientRect()
      const previewHeight = previewRect.height

      // Ensure mouse Y is within preview's vertical range
      // Position preview so mouse is roughly in the upper third
      top = mouseY - previewHeight * 0.3

      // Clamp to viewport bounds
      const minTop = PREVIEW_MARGIN
      const maxTop = viewportHeight - previewHeight - PREVIEW_MARGIN
      top = Math.max(minTop, Math.min(top, maxTop))

      nodePreviewStyle.value = {
        ...nodePreviewStyle.value,
        top: `${top}px`
      }
    }
  })
}

function handleMouseLeave() {
  isHovered.value = false
}
</script>
